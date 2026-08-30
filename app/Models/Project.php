<?php

namespace App\Models;

use App\Concerns\GeneratesUniqueProjectSlugs;
use App\Support\ProjectContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class Project extends Model implements HasMedia, ProjectContext
{
    use GeneratesUniqueProjectSlugs, HasFactory, InteractsWithMedia;

    /**
     * Bootstrap the model and its traits.
     */
    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Project $project) {
            if (empty($project->slug)) {
                $project->slug = static::generateUniqueProjectSlug($project->name);
            }
        });

        static::updating(function (Project $project) {
            if ($project->isDirty('name')) {
                $project->slug = static::generateUniqueProjectSlug($project->name, $project->id);
            }
        });
    }

    protected $fillable = [
        'team_id',
        'name',
        'slug',
        'api_token',
        'url',
        'uptime_monitoring_enabled',
        'uptime_check_interval',
        'last_uptime_check_at',
        'last_uptime_status',
        'retention_days',
        'rollup_retention_days',
        'settings',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'api_token',
        'settings',
    ];

    protected $appends = ['logo_url'];

    public function getLogoUrlAttribute()
    {
        $media = $this->getFirstMedia('logo');

        return $media
            ? $media->getUrl()
            : 'https://ui-avatars.com/api/?name='.urlencode($this->name).'&color=7F9CF5&background=EBF4FF';
    }

    protected $casts = [
        'settings' => 'array',
        'last_uptime_check_at' => 'datetime',
        'uptime_monitoring_enabled' => 'boolean',
    ];

    /**
     * Determine whether this project is eligible for uptime checks.
     */
    public function hasUptimeMonitoring(): bool
    {
        return $this->uptime_monitoring_enabled && filled($this->url);
    }

    /**
     * Scope the query to projects that should be checked for uptime.
     */
    public function scopeWithUptimeMonitoring(Builder $query): Builder
    {
        return $query->where('uptime_monitoring_enabled', true)->whereNotNull('url');
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * @return array<int, int>
     */
    public function projectIds(): array
    {
        return [$this->id];
    }

    public function isAggregate(): bool
    {
        return false;
    }

    public function contextLabel(): string
    {
        return $this->name;
    }

    public function contextSlug(): string
    {
        return $this->slug;
    }

    /**
     * Get the absolute URL to this project's dashboard.
     *
     * Built against the configured app URL so it stays correct when generated
     * outside of an HTTP request, such as from a queued job or scheduled command.
     */
    public function dashboardUrl(): string
    {
        $this->loadMissing('team');

        return rtrim(config('app.url'), '/').route('dashboard', [
            'current_team' => $this->team,
            'project' => $this,
        ], absolute: false);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function records(): HasMany
    {
        return $this->hasMany(Record::class);
    }

    public function rollups(): HasMany
    {
        return $this->hasMany(RecordRollup::class);
    }

    public function userBuckets(): HasMany
    {
        return $this->hasMany(RecordUserBucket::class);
    }

    public function issues(): HasMany
    {
        return $this->hasMany(Issue::class);
    }

    public function integrations(): HasMany
    {
        return $this->hasMany(Integration::class);
    }

    public function alertRules(): HasMany
    {
        return $this->hasMany(AlertRule::class);
    }

    /**
     * Alias of {@see alertRules()} so scoped route binding of the `{rule}`
     * parameter resolves against this project.
     */
    public function rules(): HasMany
    {
        return $this->hasMany(AlertRule::class);
    }

    public function thresholds(): HasMany
    {
        return $this->hasMany(Threshold::class);
    }

    public function uptimeChecks(): HasMany
    {
        return $this->hasMany(UptimeCheck::class);
    }

    public function heartbeats(): HasMany
    {
        return $this->hasMany(Heartbeat::class);
    }
}
