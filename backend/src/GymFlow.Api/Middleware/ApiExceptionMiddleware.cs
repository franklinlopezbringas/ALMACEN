using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Api.Middleware;

public sealed partial class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (BadHttpRequestException) { await WriteAsync(context,400,"Invalid request","Request body or parameters are invalid."); }
        catch (DbUpdateConcurrencyException) { await WriteAsync(context,409,"Concurrent update","The record changed. Reload and retry."); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql && (sql.Number is 547 or 2601 or 2627 || sql.Number is >= 51000 and < 52000))
        { await WriteAsync(context,409,"Data conflict","The operation violates a data integrity rule."); }
        catch (SqlException ex) when (ex.Number is 1205 or 51030)
        { await WriteAsync(context,409,"Concurrent operation","Retry the operation after reloading its state."); }
        catch (KeyNotFoundException) { await WriteAsync(context,404,"Not found","The record was not found."); }
        catch (ArgumentException ex) { await WriteAsync(context,400,"Invalid request",ex.Message); }
        catch (InvalidOperationException ex) { await WriteAsync(context,409,"Business rule conflict",ex.Message); }
        catch (UnauthorizedAccessException ex) { await WriteAsync(context,403,"Forbidden",ex.Message); }
        catch (Exception ex)
        {
            LogUnhandled(logger,context.TraceIdentifier,ex);
            await WriteAsync(context,500,"Unexpected error","An unexpected error occurred.");
        }
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Unhandled API error. CorrelationId={CorrelationId}")]
    private static partial void LogUnhandled(ILogger logger, string correlationId, Exception exception);

    private static async Task WriteAsync(HttpContext context,int status,string title,string detail)
    {
        if (context.Response.HasStarted) return;
        context.Response.StatusCode=status;
        context.Response.ContentType="application/problem+json";
        var problem = new ProblemDetails { Status=status, Title=title, Detail=detail };
        problem.Extensions["traceId"] = context.TraceIdentifier;
        await context.Response.WriteAsJsonAsync(problem);
    }
}
