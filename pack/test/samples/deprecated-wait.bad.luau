local function blink(part: BasePart)
	part.Transparency = 1
	wait(0.5)
	part.Transparency = 0
end

return blink
