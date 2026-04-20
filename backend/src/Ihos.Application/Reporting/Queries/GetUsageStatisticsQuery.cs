using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Reporting.Queries;

public record GetUsageStatisticsQuery(
    DateTime From,
    DateTime To,
    string Granularity = "daily"   // daily | weekly | monthly
) : IRequest<UsageStatisticsResult>;

public record UsageStatisticsResult(
    IReadOnlyList<UsageStatisticsBucket> Buckets,
    int TotalQuotations,
    DateTime From,
    DateTime To,
    string Granularity
);

public record UsageStatisticsBucket(
    DateTime PeriodStart,
    int QuotationCount
);

public class GetUsageStatisticsQueryHandler
    : IRequestHandler<GetUsageStatisticsQuery, UsageStatisticsResult>
{
    private readonly IReportingRepository _reporting;

    public GetUsageStatisticsQueryHandler(IReportingRepository reporting) => _reporting = reporting;

    public async Task<UsageStatisticsResult> Handle(
        GetUsageStatisticsQuery request, CancellationToken ct)
    {
        var from = request.From.Date;
        var to = request.To.Date.AddDays(1).AddTicks(-1);

        var dates = await _reporting.GetQuotationDatesAsync(from, to, ct);
        var buckets = GroupIntoBuckets(dates, from, to, request.Granularity);

        return new UsageStatisticsResult(buckets, dates.Count, from, to, request.Granularity);
    }

    private static IReadOnlyList<UsageStatisticsBucket> GroupIntoBuckets(
        IEnumerable<DateTime> dates, DateTime from, DateTime to, string granularity)
    {
        var grouped = granularity.ToLower() switch
        {
            "weekly" => dates.GroupBy(d => d.Date.AddDays(-(int)d.DayOfWeek)),
            "monthly" => dates.GroupBy(d => new DateTime(d.Year, d.Month, 1)),
            _ => dates.GroupBy(d => d.Date)
        };
        var dict = grouped.ToDictionary(g => g.Key, g => g.Count());

        var result = new List<UsageStatisticsBucket>();
        var cursor = granularity.ToLower() switch
        {
            "weekly" => from.AddDays(-(int)from.DayOfWeek),
            "monthly" => new DateTime(from.Year, from.Month, 1),
            _ => from.Date
        };

        while (cursor <= to)
        {
            result.Add(new UsageStatisticsBucket(cursor, dict.GetValueOrDefault(cursor, 0)));
            cursor = granularity.ToLower() switch
            {
                "weekly" => cursor.AddDays(7),
                "monthly" => cursor.AddMonths(1),
                _ => cursor.AddDays(1)
            };
        }

        return result;
    }
}
