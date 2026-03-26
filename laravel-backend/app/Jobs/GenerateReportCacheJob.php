<?php

namespace App\Jobs;

use App\Services\ReportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class GenerateReportCacheJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly string $report,
        public readonly array $params = []
    ) {}

    public function handle(ReportService $reportService): void
    {
        $reportService->warmReportCache($this->report, $this->params);
    }
}
