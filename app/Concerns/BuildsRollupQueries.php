<?php

namespace App\Concerns;

use App\Services\RecordService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * SQL-building helpers shared by services that read the `record_rollups` /
 * `record_user_buckets` family of tables: driver-aware JSON payload
 * extraction, identifier quoting, time-bucket formatting, and the small bits
 * of arithmetic (average duration, time-series gap filling) that don't
 * belong to any one project.
 *
 * The app supports MySQL/MariaDB, PostgreSQL, and SQLite (tests), so every
 * raw-SQL fragment here `match`es on the driver name explicitly rather than
 * assuming one driver's syntax as a fallback for the rest. Used by
 * {@see RecordService}, so this branching lives in exactly one place.
 */
trait BuildsRollupQueries
{
    private function jsonPathSegments(string $path): array
    {
        return explode('.', $path);
    }

    private function quoteLiteral(string $value): string
    {
        return "'".str_replace("'", "''", $value)."'";
    }

    /**
     * Extract a JSON value at `path`, keeping its native JSON type (a nested
     * object/array stays JSON; a scalar stays quoted).
     *
     * The two engines disagree on syntax, so the driver is handled
     * explicitly instead of assuming one as the default for the rest:
     * PostgreSQL via the `#>` path operator; MySQL/MariaDB and SQLite (which
     * both implement `JSON_EXTRACT`) via the `$.`-prefixed path string.
     */
    private function jsonValue(string $path): string
    {
        $driver = DB::connection()->getDriverName();

        return match ($driver) {
            'pgsql' => 'payload #> ARRAY['.implode(', ', array_map([$this, 'quoteLiteral'], $this->jsonPathSegments($path))).']',
            'mysql', 'mariadb', 'sqlite' => "JSON_EXTRACT(payload, '$.".$path."')",
            default => throw new \RuntimeException("Unsupported database driver for JSON extraction: {$driver}"),
        };
    }

    /**
     * Extract a JSON value at `path` as plain text, with quotes stripped.
     *
     * PostgreSQL's `#>>` already returns unquoted text. MySQL's
     * `JSON_EXTRACT` keeps the value JSON-quoted, so `JSON_UNQUOTE` strips
     * it; SQLite has no such function, but the test suite registers one
     * (`TestCase::setUp()`) so the same expression runs against both.
     */
    private function jsonText(string $path): string
    {
        $driver = DB::connection()->getDriverName();

        return match ($driver) {
            'pgsql' => 'payload #>> ARRAY['.implode(', ', array_map([$this, 'quoteLiteral'], $this->jsonPathSegments($path))).']',
            'mysql', 'mariadb', 'sqlite' => "JSON_UNQUOTE(JSON_EXTRACT(payload, '$.".$path."'))",
            default => throw new \RuntimeException("Unsupported database driver for JSON extraction: {$driver}"),
        };
    }

    /**
     * Cast a JSON text value to a number, or NULL if it isn't numeric.
     *
     * PostgreSQL errors on a non-numeric cast, so the value is validated
     * against a numeric pattern first; MySQL/MariaDB and SQLite tolerate a
     * `CAST` of non-numeric text, returning NULL for it directly.
     */
    private function jsonNumeric(string $path): string
    {
        $text = $this->jsonText($path);
        $driver = DB::connection()->getDriverName();
        $trimmed = "NULLIF(BTRIM({$text}), '')";

        return match ($driver) {
            'pgsql' => "CASE WHEN {$trimmed} ~ '^[+-]?([0-9]+([.][0-9]+)?|[.][0-9]+)$' THEN ({$trimmed})::numeric ELSE NULL END",
            'mysql', 'mariadb', 'sqlite' => "CAST(NULLIF({$text}, '') AS DECIMAL(20,6))",
            default => throw new \RuntimeException("Unsupported database driver for JSON extraction: {$driver}"),
        };
    }

    private function jsonDistinct(string $path): string
    {
        $driver = DB::connection()->getDriverName();

        return match ($driver) {
            'pgsql' => '('.$this->jsonValue($path).')::text',
            'mysql', 'mariadb', 'sqlite' => 'CAST('.$this->jsonValue($path).' AS CHAR)',
            default => throw new \RuntimeException("Unsupported database driver for JSON extraction: {$driver}"),
        };
    }

    private function timeBucketSql(string $period, string $column = 'created_at'): string
    {
        $driver = DB::connection()->getDriverName();

        return match ($driver) {
            'pgsql' => match ($period) {
                '7d', '14d', '30d' => "to_char({$column}, 'MM-DD')",
                'custom' => "to_char(date_trunc('hour', {$column}), 'YYYY-MM-DD HH24:00')",
                default => "to_char({$column}, 'HH24:MI')",
            },
            'mysql', 'mariadb', 'sqlite' => match ($period) {
                '7d', '14d', '30d' => "DATE_FORMAT({$column}, '%m-%d')",
                'custom' => "DATE_FORMAT({$column}, '%Y-%m-%d %H:00')",
                default => "DATE_FORMAT({$column}, '%H:%i')",
            },
            default => throw new \RuntimeException("Unsupported database driver for time-bucket formatting: {$driver}"),
        };
    }

    /**
     * Quote an identifier for the active driver.
     */
    private function col(string $name): string
    {
        return DB::connection()->getQueryGrammar()->wrap($name);
    }

    /**
     * The mean duration. Averages are not additive, so they are recomputed
     * from the summed numerator/denominator rather than stored directly.
     */
    protected function avgDuration(object $totals): float
    {
        $count = (int) ($totals->count_duration ?? 0);

        return $count > 0 ? ((float) $totals->sum_duration) / $count : 0.0;
    }

    /**
     * The chart key a grouped row belongs to.
     */
    private function seriesKey(string $value, bool $groupedByMinute): string
    {
        return $groupedByMinute ? Carbon::parse($value)->format('H:i') : $value;
    }

    /**
     * Fill missing time slots with zeroed data.
     */
    protected function fillTimeSeriesGaps($results, string $period, ?string $from = null, ?string $to = null): array
    {
        $data = [];
        $now = now();

        $iterations = match ($period) {
            '1h' => 60,
            '24h' => 1440,
            '7d' => 7,
            '14d' => 14,
            '30d' => 30,
            default => 60,
        };

        $unit = match ($period) {
            '7d', '14d', '30d' => 'day',
            default => 'minute',
        };

        $dateFormat = match ($period) {
            '7d', '14d', '30d' => 'm-d',
            '24h' => 'H:i',
            default => 'H:i',
        };

        for ($i = $iterations - 1; $i >= 0; $i--) {
            $time = (clone $now)->sub($unit, $i);
            $key = $time->format($dateFormat);

            if ($results->has($key)) {
                $data[] = $results->get($key);
            } else {
                $data[] = [
                    'minute' => $key,
                    'total' => 0,
                    'ok' => 0,
                    'client_error' => 0,
                    'server_error' => 0,
                    'avg_duration' => 0,
                    'hits' => 0,
                    'misses' => 0,
                    'writes' => 0,
                    'active_users' => 0,
                    'total_requests' => 0,
                    'authed' => 0,
                    'guest' => 0,
                ];
            }
        }

        return $data;
    }
}
