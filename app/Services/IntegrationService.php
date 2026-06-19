<?php

namespace App\Services;

use App\Models\Integration;
use App\Models\Issue;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class IntegrationService
{
    /**
     * Send notification for a specific issue to all enabled integrations.
     */
    public function notify(Issue $issue): void
    {
        $project = $issue->project;
        $integrations = $project->integrations()->where('is_enabled', true)->get();

        $title = '🚨 New '.strtoupper($issue->type).' Alert';
        $message = "*{$issue->title}*\n{$issue->message}";
        $url = config('app.url')."/projects/{$issue->project->slug}/issues/{$issue->id}";

        foreach ($integrations as $integration) {
            $this->send($integration, $title, $message, [
                'Project' => $issue->project->name,
                'Priority' => strtoupper($issue->priority),
            ], $url);
        }
    }

    /**
     * Send a generic notification to an integration.
     */
    public function send(Integration $integration, string $title, string $message, array $fields = [], ?string $url = null): void
    {
        try {
            $this->dispatchToDriver($integration, $title, $message, $fields, $url);

            if ($integration->status !== 'healthy') {
                $integration->update(['status' => 'healthy', 'last_error' => null]);
            }
        } catch (\Exception $e) {
            Log::error('Integration failed: '.$integration->type.' - '.$e->getMessage());
            $integration->update([
                'status' => 'failing',
                'last_error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Dispatch the notification to the correct driver.
     */
    protected function dispatchToDriver(Integration $integration, string $title, string $message, array $fields = [], ?string $url = null): void
    {
        match ($integration->type) {
            'slack' => $this->sendToSlack($integration, $title, $message, $fields, $url),
            'discord' => $this->sendToDiscord($integration, $title, $message, $fields, $url),
            'telegram' => $this->sendToTelegram($integration, $title, $message, $fields, $url),
            'webhook' => $this->sendToWebhook($integration, $title, $message, $fields, $url),
            'email' => $this->sendToEmail($integration, $title, $message, $fields, $url),
            'gotify' => $this->sendToGotify($integration, $title, $message, $fields, $url),
            default => null,
        };
    }

    protected function sendToSlack(Integration $integration, string $title, string $message, array $fields = [], ?string $url = null): void
    {
        $webhookUrl = $integration->data['webhook_url'] ?? null;
        if (! $webhookUrl) {
            return;
        }

        $slackFields = [];
        foreach ($fields as $label => $value) {
            $slackFields[] = ['type' => 'mrkdwn', 'text' => "*{$label}:* {$value}"];
        }

        $blocks = [
            [
                'type' => 'header',
                'text' => [
                    'type' => 'plain_text',
                    'text' => $title,
                ],
            ],
        ];

        if (! empty($slackFields)) {
            $blocks[] = ['type' => 'section', 'fields' => $slackFields];
        }

        $blocks[] = [
            'type' => 'section',
            'text' => [
                'type' => 'mrkdwn',
                'text' => $message,
            ],
        ];

        if ($url) {
            $blocks[] = [
                'type' => 'actions',
                'elements' => [
                    [
                        'type' => 'button',
                        'text' => ['type' => 'plain_text', 'text' => 'View Details'],
                        'url' => $url,
                        'style' => 'primary',
                    ],
                ],
            ];
        }

        Http::post($webhookUrl, ['blocks' => $blocks]);
    }

    protected function sendToDiscord(Integration $integration, string $title, string $message, array $fields = [], ?string $url = null): void
    {
        $webhookUrl = $integration->data['webhook_url'] ?? null;
        if (! $webhookUrl) {
            return;
        }

        $discordFields = [];
        foreach ($fields as $label => $value) {
            $discordFields[] = ['name' => $label, 'value' => (string) $value, 'inline' => true];
        }

        Http::post($webhookUrl, [
            'embeds' => [[
                'title' => $title,
                'description' => $message,
                'url' => $url,
                'color' => 0x3498DB,
                'fields' => $discordFields,
                'timestamp' => now()->toIso8601String(),
            ]],
        ]);
    }

    protected function sendToTelegram(Integration $integration, string $title, string $message, array $fields = [], ?string $url = null): void
    {
        $botToken = $integration->data['bot_token'] ?? null;
        $chatId = $integration->data['chat_id'] ?? null;
        if (! $botToken || ! $chatId) {
            return;
        }

        $text = "*{$title}*\n\n";
        foreach ($fields as $label => $value) {
            $text .= "*{$label}:* {$value}\n";
        }
        $text .= "\n{$message}\n\n";
        if ($url) {
            $text .= "[View Details]({$url})";
        }

        Http::post("https://api.telegram.org/bot{$botToken}/sendMessage", [
            'chat_id' => $chatId,
            'text' => $text,
            'parse_mode' => 'Markdown',
        ]);
    }

    protected function sendToWebhook(Integration $integration, string $title, string $message, array $fields = [], ?string $url = null): void
    {
        $webhookUrl = $integration->data['url'] ?? null;
        if (! $webhookUrl) {
            return;
        }

        Http::post($webhookUrl, [
            'event' => 'laraowl.alert',
            'title' => $title,
            'message' => $message,
            'fields' => $fields,
            'url' => $url,
            'timestamp' => now()->timestamp,
        ]);
    }

    protected function sendToEmail(Integration $integration, string $title, string $message, array $fields = [], ?string $url = null): void
    {
        $email = $integration->data['email'] ?? null;
        if (! $email) {
            return;
        }

        $body = "{$title}\n\n";
        foreach ($fields as $label => $value) {
            $body .= "{$label}: {$value}\n";
        }
        $body .= "\n{$message}\n\n";
        if ($url) {
            $body .= "View details: {$url}";
        }

        Mail::raw($body, function ($m) use ($email, $title) {
            $m->to($email)->subject($title);
        });
    }

    protected function sendToGotify(Integration $integration, string $title, string $message, array $fields = [], ?string $url = null): void
    {
        $serverUrl = $integration->data['server_url'] ?? null;
        $appToken = $integration->data['app_token'] ?? null;
        if (! $serverUrl || ! $appToken) {
            return;
        }

        $body = '';
        foreach ($fields as $label => $value) {
            $body .= "**{$label}:** {$value}\n";
        }
        $body .= "\n{$message}\n";
        if ($url) {
            $body .= "\n[View Details]({$url})";
        }

        Http::withHeaders(['X-Gotify-Key' => $appToken])
            ->post(rtrim($serverUrl, '/').'/message', [
                'title' => $title,
                'message' => $body,
                'priority' => 5,
                'extras' => [
                    'client::display' => ['contentType' => 'text/markdown'],
                ],
            ]);
    }

    public function getAvailableTypes(): array
    {
        return [
            [
                'id' => 'slack',
                'name' => 'Slack',
                'fields' => [
                    ['name' => 'webhook_url', 'label' => 'Webhook URL', 'type' => 'url', 'placeholder' => 'https://hooks.slack.com/services/...'],
                ],
            ],
            [
                'id' => 'discord',
                'name' => 'Discord',
                'fields' => [
                    ['name' => 'webhook_url', 'label' => 'Webhook URL', 'type' => 'url', 'placeholder' => 'https://discord.com/api/webhooks/...'],
                ],
            ],
            [
                'id' => 'telegram',
                'name' => 'Telegram',
                'fields' => [
                    ['name' => 'bot_token', 'label' => 'Bot Token', 'type' => 'password', 'placeholder' => '123456:ABC-DEF...'],
                    ['name' => 'chat_id', 'label' => 'Chat ID', 'type' => 'text', 'placeholder' => '-100123456789'],
                ],
            ],
            [
                'id' => 'webhook',
                'name' => 'Webhook',
                'fields' => [
                    ['name' => 'url', 'label' => 'Webhook URL', 'type' => 'url', 'placeholder' => 'https://api.yourdomain.com/webhook'],
                ],
            ],
            [
                'id' => 'email',
                'name' => 'Email',
                'fields' => [
                    ['name' => 'email', 'label' => 'Email Address', 'type' => 'email', 'placeholder' => 'ops@example.com'],
                ],
            ],
            [
                'id' => 'gotify',
                'name' => 'Gotify',
                'fields' => [
                    ['name' => 'server_url', 'label' => 'Server URL', 'type' => 'url', 'placeholder' => 'https://gotify.example.com'],
                    ['name' => 'app_token', 'label' => 'App Token', 'type' => 'password', 'placeholder' => 'A...'],
                ],
            ],
        ];
    }
}
