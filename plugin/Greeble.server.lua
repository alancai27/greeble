--!strict
-- Greeble Studio plugin: thin client. It samples the zone, asks the server
-- where things go, and creates the instances. No placement logic lives here.
--
-- Setup in Studio:
--   1. Put a Part named "GreebleZone" over the area to dress (it is only a bounds box).
--   2. Put the asset kit (Models with a PrimaryPart) in a Folder named "GreebleKit" in ServerStorage.
--   3. Optional: Parts tagged "GreebleKeepClear" mark paths and spawns.
--   4. Run `plugin:SetSetting("GreebleKey", "...")` and `plugin:SetSetting("GreebleUrl", "https://...")` once in the command bar.

local HttpService = game:GetService("HttpService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local CollectionService = game:GetService("CollectionService")
local ServerStorage = game:GetService("ServerStorage")

local CELL = 4

local toolbar = plugin:CreateToolbar("Greeble")
local button = toolbar:CreateButton("Dress zone", "Place kit assets in GreebleZone", "")

local function v3(v: Vector3) return { v.X, v.Y, v.Z } end

local function boxOf(part: BasePart)
	local half = part.Size / 2
	return { min = v3(part.Position - half), max = v3(part.Position + half) }
end

local function sampleSurface(zone: BasePart)
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	local ignore: { Instance } = { zone }
	local out = workspace:FindFirstChild("Greeble")
	if out then table.insert(ignore, out) end
	params.FilterDescendantsInstances = ignore

	local half = zone.Size / 2
	local top = zone.Position.Y + half.Y
	local hits = {}
	for x = -half.X, half.X, CELL do
		for z = -half.Z, half.Z, CELL do
			local origin = Vector3.new(zone.Position.X + x, top, zone.Position.Z + z)
			local hit = workspace:Raycast(origin, Vector3.new(0, -zone.Size.Y, 0), params)
			if hit then
				table.insert(hits, { position = v3(hit.Position), normal = v3(hit.Normal) })
			end
		end
	end
	return hits
end

local function readKit(kit: Instance)
	local assets, byId = {}, {}
	for _, child in kit:GetChildren() do
		if child:IsA("Model") then
			local size = child:GetExtentsSize()
			table.insert(assets, { id = child.Name, footprint = math.max(size.X, size.Z) / 2 })
			byId[child.Name] = child
		end
	end
	return assets, byId
end

local function post(path: string, body: any)
	local url = plugin:GetSetting("GreebleUrl")
	local key = plugin:GetSetting("GreebleKey")
	assert(url and key, "Set GreebleUrl and GreebleKey first")
	local res = HttpService:RequestAsync({
		Url = url .. path,
		Method = "POST",
		Headers = { ["Content-Type"] = "application/json", Authorization = "Bearer " .. key },
		Body = HttpService:JSONEncode(body),
	})
	assert(res.Success, "Greeble server: " .. tostring(res.StatusCode))
	return HttpService:JSONDecode(res.Body)
end

local function dress()
	local zone = workspace:FindFirstChild("GreebleZone")
	local kit = ServerStorage:FindFirstChild("GreebleKit")
	assert(zone and zone:IsA("BasePart"), "Add a Part named GreebleZone")
	assert(kit, "Add a Folder named GreebleKit to ServerStorage")

	local assets, byId = readKit(kit)
	local keepClear = {}
	for _, part in CollectionService:GetTagged("GreebleKeepClear") do
		if part:IsA("BasePart") then table.insert(keepClear, boxOf(part)) end
	end
	local profileJson = plugin:GetSetting("GreebleProfile")
	assert(profileJson, "No style profile saved yet")

	local result = post("/v1/place", {
		zone = { id = zone:GetAttribute("ZoneId") or "zone", label = zone:GetAttribute("Label") or "" },
		surface = sampleSurface(zone :: BasePart),
		cell = CELL,
		assets = assets,
		keepClear = keepClear,
		profile = HttpService:JSONDecode(profileJson),
		budget = { maxInstances = zone:GetAttribute("MaxInstances") or 500 },
		seed = zone:GetAttribute("Seed") or 1,
	})

	local recording = ChangeHistoryService:TryBeginRecording("Greeble: dress zone")
	local root = workspace:FindFirstChild("Greeble") or Instance.new("Folder")
	root.Name = "Greeble"
	root.Parent = workspace
	local folder = Instance.new("Folder")
	folder.Name = (zone:GetAttribute("ZoneId") or "zone") :: string
	folder.Parent = root

	for _, p in result.placements do
		local source = byId[p.assetId]
		if source then
			local clone = source:Clone()
			clone:ScaleTo(p.scale)
			local height = clone:GetExtentsSize().Y / 2
			local pos = Vector3.new(p.position[1], p.position[2] + height, p.position[3])
			clone:PivotTo(CFrame.new(pos) * CFrame.Angles(0, p.rotationY, 0))
			clone.Parent = folder
		end
	end
	if recording then
		ChangeHistoryService:FinishRecording(recording, Enum.FinishRecordingOperation.Commit)
	end
	print(("Greeble placed %d instances"):format(result.stats.placed))
end

button.Click:Connect(function()
	local ok, err = pcall(dress)
	if not ok then warn(err) end
end)
