local Players = game:GetService("Players")
local player = Players.LocalPlayer

script.Parent.Activated:Connect(function()
	player.leaderstats.Coins.Value += 10
end)
