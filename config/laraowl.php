<?php

return [

    /*
    |--------------------------------------------------------------------------
    | LaraOwl Server Configuration
    |--------------------------------------------------------------------------
    |
    | Tunables for the receiving-side LaraOwl monitoring server. These are
    | separate from the laraowl/client configuration that ships with the
    | monitored applications.
    |
    */

    /*
     * Maximum frequency (in whole seconds) at which the ProjectDataIngested
     * broadcast can fire per project. The IngestService wraps the dispatch in
     * a non-blocking Cache::lock so a flood of ingest batches cannot fan out
     * realtime updates faster than this.
     */
    'broadcast_throttle_sec' => (int) env('LARAOWL_BROADCAST_THROTTLE_SEC', 1),

    /*
     * Named queues used by the async ingest pipeline. Documented here so
     * operators can override them in environments that share a queue
     * instance with other applications.
     */
    'queues' => [
        'ingest' => env('LARAOWL_QUEUE_INGEST', 'laraowl-ingest'),
        'enrichment' => env('LARAOWL_QUEUE_ENRICHMENT', 'laraowl-enrichment'),
    ],

];
