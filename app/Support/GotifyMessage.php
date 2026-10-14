<?php

namespace App\Support;

/**
 * Builds the Markdown body of a Gotify message.
 *
 * Gotify renders `text/markdown` messages as GFM in the web UI and as
 * CommonMark in the Android app, whose notifications support neither tables
 * nor bare-URL links and treat single line breaks as spaces. Alert content
 * comes from the monitored applications, so it is escaped to keep it from
 * injecting remote images (both clients load them automatically) or markup.
 */
final class GotifyMessage
{
    /**
     * Format the alert as: message, a list of the non-empty fields, then a link.
     *
     * The message comes first because the collapsed Android notification
     * only shows the beginning of the body.
     *
     * @param  array<string, scalar|null>  $fields
     */
    public static function format(string $message, array $fields = [], ?string $url = null): string
    {
        $blocks = [];

        $body = self::paragraphs($message);
        if ($body !== '') {
            $blocks[] = $body;
        }

        $items = [];
        foreach ($fields as $label => $value) {
            if ($value === null || $value === '') {
                continue;
            }
            $items[] = '- **'.self::escape((string) $label).':** '.self::fieldValue((string) $value);
        }
        if ($items !== []) {
            $blocks[] = implode("\n", $items);
        }

        if ($url !== null && self::isLinkable($url)) {
            $blocks[] = "[View Details](<{$url}>)";
        }

        return implode("\n\n", $blocks);
    }

    /**
     * Map the alert's issue priority onto Gotify's 0-10 scale.
     *
     * The Android app turns it into the notification importance: 1-3 low
     * (silent), 4-7 default (sound), 8 and above high (pops up on screen).
     * Issues without a priority (`none`), `medium` ones and alerts that
     * carry no priority at all (uptime, heartbeat, ...) use Gotify's default.
     *
     * @param  array<string, scalar|null>  $fields
     */
    public static function priority(array $fields): int
    {
        return match (strtolower((string) ($fields['Priority'] ?? ''))) {
            'low' => 2,
            'high' => 8,
            'critical' => 10,
            default => 5,
        };
    }

    /**
     * Escape the text and keep its line breaks, which Markdown would otherwise collapse.
     */
    private static function paragraphs(string $text): string
    {
        $text = trim(str_replace(["\r\n", "\r"], "\n", $text));
        if ($text === '') {
            return '';
        }

        $paragraphs = array_map(
            fn (string $paragraph): string => implode("\\\n", array_map(
                fn (string $line): string => self::escape(trim($line)),
                explode("\n", $paragraph),
            )),
            preg_split('/\n\s*\n/', $text),
        );

        return implode("\n\n", $paragraphs);
    }

    private static function fieldValue(string $value): string
    {
        $value = trim(preg_replace('/\s+/', ' ', $value));

        return self::isLinkable($value) ? "<{$value}>" : self::escape($value);
    }

    /**
     * Neutralise every character that can start inline Markdown or HTML, and
     * the ones that start a block (list, heading, quote) at the line start.
     */
    private static function escape(string $text): string
    {
        $text = preg_replace('/[\\\\`*_\[\]<>!#|~&]/', '\\\\$0', $text);
        $text = preg_replace('/^[-+=]/', '\\\\$0', $text);

        return preg_replace('/^(\d+)([.)])/', '$1\\\\$2', $text);
    }

    private static function isLinkable(string $url): bool
    {
        return preg_match('#^https?://[^\s<>]+$#i', $url) === 1;
    }
}
