local ReplicatedStorage = game:GetService("ReplicatedStorage")
local buy = ReplicatedStorage.Remotes.BuyItem

buy.OnServerEvent:Connect(function(player, itemId, amount)
	if typeof(itemId) ~= "string" or typeof(amount) ~= "number" then
		return
	end
	local stock = workspace.Shop:FindFirstChild(itemId)
	if stock then
		stock.Count.Value -= math.clamp(amount, 1, 10)
		print(player.Name, "bought", amount)
	end
end)
