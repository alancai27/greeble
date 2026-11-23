local ReplicatedStorage = game:GetService("ReplicatedStorage")
local buy = ReplicatedStorage.Remotes.BuyItem

buy.OnServerEvent:Connect(function(player, itemId, amount)
	local stock = workspace.Shop[itemId]
	stock.Count.Value -= amount
	print(player.Name, "bought", amount)
end)
