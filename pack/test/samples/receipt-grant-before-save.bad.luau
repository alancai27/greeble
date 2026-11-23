local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")

MarketplaceService.ProcessReceipt = function(receiptInfo)
	local player = Players:GetPlayerByUserId(receiptInfo.PlayerId)
	if player then
		player:SetAttribute("Gems", (player:GetAttribute("Gems") or 0) + 100)
	end
	return Enum.ProductPurchaseDecision.PurchaseGranted
end
