local MarketplaceService = game:GetService("MarketplaceService")
local DataStoreService = game:GetService("DataStoreService")

local purchases = DataStoreService:GetDataStore("Purchases")

local function processReceipt(receiptInfo)
	local key = receiptInfo.PlayerId .. "_" .. receiptInfo.PurchaseId
	local ok = pcall(function()
		purchases:UpdateAsync(key, function(seen)
			return seen or true
		end)
	end)
	if not ok then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	return Enum.ProductPurchaseDecision.PurchaseGranted
end

MarketplaceService.ProcessReceipt = processReceipt
