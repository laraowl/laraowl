<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 2 async ingest: add a per-batch identifier to records.
 *
 * IngestService::ingestBulk() generates a UUID per call and stamps every
 * inserted row with it. ProcessRecordEnrichment dispatch then re-queries
 * scoped strictly by this batch id, so two concurrent ingest workers that
 * happen to share a fingerprint cannot cross-dispatch enrichment for each
 * other's rows.
 *
 * Backward compatible: existing rows have NULL batch_id; new rows get a
 * UUID. The column is indexed so the re-query is O(log N).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('records', function (Blueprint $table): void {
            $table->char('batch_id', 36)->nullable()->after('fingerprint');
            $table->index('batch_id', 'records_batch_id_idx');
        });
    }

    public function down(): void
    {
        Schema::table('records', function (Blueprint $table): void {
            $table->dropIndex('records_batch_id_idx');
            $table->dropColumn('batch_id');
        });
    }
};
