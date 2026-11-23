-- Old code called wait(0.5) here; task.wait is the replacement.
local function blink(part: BasePart)
	part.Transparency = 1
	task.wait(0.5)
	part.Transparency = 0
	task.delay(1, function()
		part:Destroy()
	end)
end

return blink
