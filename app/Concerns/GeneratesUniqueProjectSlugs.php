<?php

namespace App\Concerns;

use App\Support\TeamProjectScope;
use Illuminate\Support\Str;

trait GeneratesUniqueProjectSlugs
{
    /**
     * Generate a unique slug for the project.
     *
     * Treats the reserved `TeamProjectScope::SLUG` ("all") as always taken,
     * so a project can never collide with the "All" aggregate route.
     */
    protected static function generateUniqueProjectSlug(string $name, ?int $excludeId = null): string
    {
        $defaultSlug = Str::slug($name);
        $reserved = $defaultSlug === TeamProjectScope::SLUG;

        $query = static::where(function ($query) use ($defaultSlug) {
            $query->where('slug', $defaultSlug)
                ->orWhere('slug', 'like', $defaultSlug.'-%');
        });

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        $existingSlugs = $query->pluck('slug');

        $maxSuffix = $existingSlugs
            ->map(function (string $slug) use ($defaultSlug): ?int {
                if ($slug === $defaultSlug) {
                    return 0;
                } elseif (preg_match('/^'.preg_quote($defaultSlug, '/').'-(\d+)$/', $slug, $matches)) {
                    return (int) $matches[1];
                }

                return null;
            })
            ->filter(fn (?int $suffix) => $suffix !== null)
            ->max() ?? 0;

        return $existingSlugs->isEmpty() && ! $reserved
            ? $defaultSlug
            : $defaultSlug.'-'.($maxSuffix + 1);
    }
}
