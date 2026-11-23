local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer
local label = script.Parent.CoinsLabel

script.Parent.Activated:Connect(function()
	ReplicatedStorage.Remotes.ClaimReward:FireServer()
end)

player.leaderstats.Coins.Changed:Connect(function()
	if player.leaderstats.Coins.Value == 0 then
		label.Text = "Broke"
	else
		label.Text = tostring(player.leaderstats.Coins.Value)
	end
end)
