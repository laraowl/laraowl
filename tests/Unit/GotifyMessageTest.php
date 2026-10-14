<?php

use App\Support\GotifyMessage;
use Illuminate\Support\Str;

test('it puts the message first, then the fields and the link', function () {
    expect(GotifyMessage::format(
        'Something broke.',
        ['Project' => 'Demo', 'Priority' => 'HIGH'],
        'https://laraowl.test/issues/1',
    ))->toBe(<<<'MD'
        Something broke.

        - **Project:** Demo
        - **Priority:** HIGH

        [View Details](<https://laraowl.test/issues/1>)
        MD);
});

test('it skips empty fields and leaves out a missing link', function () {
    expect(GotifyMessage::format('Test', ['Project' => 'Demo', 'Priority' => '', 'Owner' => null]))
        ->toBe("Test\n\n- **Project:** Demo");
});

test('it keeps the line breaks of the message', function () {
    $html = Str::markdown(GotifyMessage::format("The site returned a 500 status code.\nError: timeout\n\nRetrying."));

    expect($html)->toBe("<p>The site returned a 500 status code.<br />\nError: timeout</p>\n<p>Retrying.</p>\n");
});

test('it links url field values', function () {
    $html = Str::markdown(GotifyMessage::format('Down', ['URL' => 'https://example.com/health', 'Status' => 500]));

    expect($html)->toContain('<strong>URL:</strong> <a href="https://example.com/health">https://example.com/health</a>')
        ->toContain('<strong>Status:</strong> 500');
});

test('it maps the issue priority onto the gotify priority levels', function (array $fields, int $priority) {
    expect(GotifyMessage::priority($fields))->toBe($priority);
})->with([
    'low' => [['Priority' => 'LOW'], 2],
    'none' => [['Priority' => 'NONE'], 5],
    'medium' => [['Priority' => 'MEDIUM'], 5],
    'high' => [['Priority' => 'HIGH'], 8],
    'critical' => [['Priority' => 'CRITICAL'], 10],
    'no priority' => [['Project' => 'Demo'], 5],
    'unknown priority' => [['Priority' => 'URGENT'], 5],
]);

test('it renders untrusted content as plain text', function (string $content) {
    $html = Str::markdown(GotifyMessage::format($content, ['Value' => $content]), ['html_input' => 'allow']);

    preg_match_all('/<([a-z0-9]+)/', $html, $tags);
    preg_match_all('#<a href="([^"]*)">(.*?)</a>#', $html, $links, PREG_SET_ORDER);

    expect(array_unique($tags[1]))->each->toBeIn(['p', 'ul', 'li', 'strong', 'a'])
        ->and(substr_count(html_entity_decode(strip_tags($html)), $content))->toBe(2);

    // GFM still links bare URLs, but only with the URL itself as the visible text.
    foreach ($links as [, $href, $text]) {
        expect($text)->toBe($href);
    }
})->with([
    'remote image' => '![pixel](https://evil.test/pixel.png)',
    'raw html' => '<img src="https://evil.test/pixel.png">',
    'html comment' => '<!-- hidden -->',
    'hidden link' => '[click here](https://evil.test)',
    'emphasis' => '**bold** _italic_ ~~strike~~ `code`',
    'heading' => '# Heading',
    'list' => '- item',
    'ordered list' => '1. item',
    'quote' => '> quote',
    'thematic break' => '---',
    'table row' => '| a | b |',
    'entity' => 'Fish &amp; chips',
    'backslashes' => 'Call to undefined method App\Models\User::foo_bar()',
    'trailing backslash' => 'C:\path\\',
]);
