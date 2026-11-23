local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("Coins")

local function addCoins(player: Player, amount: number)
	local key = "player_" .. player.UserId
	local coins = store:GetAsync(key) or 0
	store:SetAsync(key, coins + amount)
end

return addCoins
