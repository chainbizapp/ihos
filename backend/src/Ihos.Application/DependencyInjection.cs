using FluentValidation;
using Ihos.Application.Import.Services;
using Ihos.Application.Mediator;
using Microsoft.Extensions.DependencyInjection;

namespace Ihos.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        var assembly = typeof(DependencyInjection).Assembly;

        // Register mediator
        services.AddTransient<IMediator, Mediator.Mediator>();

        // Auto-register all IRequestHandler<,> implementations from this assembly
        var handlerRegistrations = assembly.GetTypes()
            .Where(t => t is { IsAbstract: false, IsInterface: false })
            .SelectMany(t => t.GetInterfaces()
                .Where(i => i.IsGenericType &&
                            i.GetGenericTypeDefinition() == typeof(IRequestHandler<,>))
                .Select(i => (Implementation: t, Interface: i)));

        foreach (var (impl, iface) in handlerRegistrations)
            services.AddTransient(iface, impl);

        // Import job tracker (singleton — lives for the application lifetime)
        services.AddSingleton<ImportJobService>();

        // FluentValidation
        services.AddValidatorsFromAssembly(assembly);

        // Pipeline behaviors — open generic, runs before every handler
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

        return services;
    }
}
