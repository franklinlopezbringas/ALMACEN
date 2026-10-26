using System.Data;
using Microsoft.Data.SqlClient;
namespace GymFlow.Infrastructure.Persistence;
// Explicit scale is required for interpolated SQL; provider defaults otherwise round to 2 decimals.
internal static class SqlValues
{
    public static SqlParameter Money(decimal value) => new() { SqlDbType=SqlDbType.Decimal,Precision=19,Scale=4,Value=value };
    public static SqlParameter Quantity(decimal value) => new() { SqlDbType=SqlDbType.Decimal,Precision=18,Scale=3,Value=value };
}
