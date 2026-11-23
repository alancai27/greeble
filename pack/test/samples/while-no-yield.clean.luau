local part = workspace.Spinner

while true do
	part.CFrame *= CFrame.Angles(0, math.rad(1), 0)
	if part.Parent == nil then
		break
	end
	task.wait()
end
