local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("Coins")

local function addCoins(player: Player, amount: number)
	local key = "player_" .. player.UserId
	store:UpdateAsync(key, function(coins)
		return (coins or 0) + amount
	end)
end

return addCoins
