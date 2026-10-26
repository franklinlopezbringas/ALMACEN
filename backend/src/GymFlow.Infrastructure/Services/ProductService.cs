using GymFlow.Application.Contracts;
using GymFlow.Application.Services;
using GymFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Services;

public sealed class ProductService(GymFlowDbContext db) : IProductService
{
    public async Task<PagedResult<ProductListItem>> SearchAsync(string? search,long? branchId,int page,int pageSize,CancellationToken cancellationToken)
    {
        page=Math.Max(1,page); pageSize=Math.Clamp(pageSize,1,100); var term=search?.Trim();
        if (branchId is not null && !await db.Branches.AsNoTracking().AnyAsync(b => b.BranchId == branchId && b.Status == "ACTIVE", cancellationToken)) throw new KeyNotFoundException();
        var q=db.Products.AsNoTracking().Where(x=>x.Status=="ACTIVE" && (string.IsNullOrEmpty(term) || x.Name.Contains(term) || x.Sku.Contains(term)));
        var total=await q.LongCountAsync(cancellationToken);
        var rows=await q.OrderBy(x=>x.Name).ThenBy(x=>x.ProductId).Skip((page-1)*pageSize).Take(pageSize)
            .Select(x=>new ProductListItem(x.PublicId,x.Sku,x.Name,x.SalePrice,x.CurrencyCode,
                branchId==null ? null : db.InventoryBalances.Where(b=>b.BranchId==branchId && b.ProductId==x.ProductId).Select(b=>(decimal?)b.QuantityOnHand).FirstOrDefault() ?? 0,x.Status))
            .ToListAsync(cancellationToken);
        return new PagedResult<ProductListItem>(rows,page,pageSize,total);
    }
}
