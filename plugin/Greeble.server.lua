--!strict
-- Greeble Studio plugin: thin client. It samples the zone, asks the server
-- where things go, and creates the instances. No placement logic lives here.
--
-- Setup in Studio:
--   1. Put a Part named "GreebleZone" over the area to dress (it is only a bounds box).
--   2. Put the asset kit (Models with a PrimaryPart) in a Folder, by default ServerStorage/GreebleKit.
--   3. Optional: Parts tagged "GreebleKeepClear" mark paths and spawns.
--   4. Click "Settings" on the Greeble toolbar, enter the server URL, key and kit path, then Save.
--      The status line at the bottom of that widget shows the last result or error.
--   5. To learn a style, select the Folders or Models of a finished map and click "Learn style".
--      Each selection becomes one zone (its "Label" attribute, if set, names it). Every Model
--      inside whose Name matches a kit Model and whose box is that Model's box at one uniform
--      scale (axes within 15%) counts as one instance. The server stores the style
--      per key and label; nothing is saved in the plugin.
--   6. Click "Dress zone". The server uses the style learned for the zone's "Label" attribute,
--      or the unlabelled ("default") style. Optional zone attributes: ZoneId, Label, MaxInstances, Seed.

local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local CollectionService = game:GetService("CollectionService")

local CELL = 4
local DEFAULT_KIT_PATH = "ServerStorage/GreebleKit"

-- Raise a plain message with no script position prefix.
local function fail(msg: string): never
	error(msg, 0)
end

-- A server reply error: shows as `message`, and carries the server's own text for job results.
local ServerError = { __tostring = function(e) return e.message end }

local function failServer(message: string, serverText: string): never
	error(setmetatable({ message = message, serverText = serverText }, ServerError), 0)
end

-- The server's own error text if `err` came from a server reply, else nil.
local function serverTextOf(err: any): string?
	return if type(err) == "table" and getmetatable(err) == ServerError then err.serverText else nil
end

local function trim(s: string): string
	return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

local function stripSlash(s: string): string
	return (s:gsub("/+$", ""))
end

local function settingString(name: string): string?
	local v = plugin:GetSetting(name)
	if type(v) == "string" and v ~= "" then return v end
	return nil
end

local function kitPath(): string
	return settingString("GreebleKitPath") or DEFAULT_KIT_PATH
end

---------------------------------------------------------------------------
-- Settings and status widget

local toolbar = plugin:CreateToolbar("Greeble")
local button = toolbar:CreateButton("Dress zone", "Place kit assets in GreebleZone", "")
local learnButton = toolbar:CreateButton("Learn style", "Learn a style profile from the selected Folders or Models", "")
local listenButton = toolbar:CreateButton("Listen", "Run jobs sent to Greeble by your agent", "")
local settingsButton = toolbar:CreateButton("Settings", "Server URL, key, kit folder and last status", "")

local widget = plugin:CreateDockWidgetPluginGui(
	"GreebleSettings",
	DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, false, false, 320, 260, 260, 220)
)
widget.Title = "Greeble"

local root = Instance.new("Frame")
root.Size = UDim2.fromScale(1, 1)
root.BackgroundTransparency = 1
root.Parent = widget

local padding = Instance.new("UIPadding")
padding.PaddingTop = UDim.new(0, 8)
padding.PaddingBottom = UDim.new(0, 8)
padding.PaddingLeft = UDim.new(0, 8)
padding.PaddingRight = UDim.new(0, 8)
padding.Parent = root

local layout = Instance.new("UIListLayout")
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 4)
layout.Parent = root

local order = 0
local function nextOrder(): number
	order += 1
	return order
end

local function label(text: string): TextLabel
	local l = Instance.new("TextLabel")
	l.Size = UDim2.new(1, 0, 0, 16)
	l.BackgroundTransparency = 1
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.Font = Enum.Font.SourceSans
	l.TextSize = 14
	l.TextColor3 = Color3.fromRGB(200, 200, 200)
	l.Text = text
	l.LayoutOrder = nextOrder()
	l.Parent = root
	return l
end

local function field(caption: string, placeholder: string): TextBox
	label(caption)
	local box = Instance.new("TextBox")
	box.Size = UDim2.new(1, 0, 0, 24)
	box.BackgroundColor3 = Color3.fromRGB(46, 46, 46)
	box.BorderColor3 = Color3.fromRGB(80, 80, 80)
	box.TextColor3 = Color3.fromRGB(230, 230, 230)
	box.PlaceholderColor3 = Color3.fromRGB(130, 130, 130)
	box.TextXAlignment = Enum.TextXAlignment.Left
	box.Font = Enum.Font.SourceSans
	box.TextSize = 14
	box.ClearTextOnFocus = false
	box.PlaceholderText = placeholder
	box.Text = ""
	box.LayoutOrder = nextOrder()
	box.Parent = root
	return box
end

local urlBox = field("Server URL", "https://greeble.example.com")
local keyBox = field("Key", "paste key")
local kitBox = field("Kit folder path", DEFAULT_KIT_PATH)

local saveButton = Instance.new("TextButton")
saveButton.Size = UDim2.new(1, 0, 0, 26)
saveButton.BackgroundColor3 = Color3.fromRGB(0, 120, 215)
saveButton.TextColor3 = Color3.fromRGB(255, 255, 255)
saveButton.Font = Enum.Font.SourceSansBold
saveButton.TextSize = 14
saveButton.Text = "Save"
saveButton.LayoutOrder = nextOrder()
saveButton.Parent = root

local statusLabel = label("")
statusLabel.Size = UDim2.new(1, 0, 0, 60)
statusLabel.TextWrapped = true
statusLabel.TextYAlignment = Enum.TextYAlignment.Top

local function setStatus(text: string, isError: boolean?)
	statusLabel.Text = text
	statusLabel.TextColor3 = if isError then Color3.fromRGB(255, 110, 110) else Color3.fromRGB(140, 220, 140)
	if isError then warn("Greeble: " .. text) end
end

-- The key box never shows the saved key; leaving it blank keeps the saved one.
local function loadFields()
	urlBox.Text = settingString("GreebleUrl") or ""
	keyBox.Text = ""
	keyBox.PlaceholderText = if settingString("GreebleKey") then "saved (leave blank to keep)" else "paste key"
	kitBox.Text = settingString("GreebleKitPath") or DEFAULT_KIT_PATH
end
loadFields()

-- A blank key keeps the saved one; a blank kit path means the default.
local function saveSettings(rawUrl: string, rawKey: string, rawPath: string)
	local url = stripSlash(trim(rawUrl))
	local key = trim(rawKey)
	local path = stripSlash(trim(rawPath))
	plugin:SetSetting("GreebleUrl", url)
	if key ~= "" then plugin:SetSetting("GreebleKey", key) end
	plugin:SetSetting("GreebleKitPath", if path ~= "" then path else DEFAULT_KIT_PATH)
	loadFields()
	setStatus("Settings saved.")
end

saveButton.MouseButton1Click:Connect(function()
	saveSettings(urlBox.Text, keyBox.Text, kitBox.Text)
end)

settingsButton.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)
widget:GetPropertyChangedSignal("Enabled"):Connect(function()
	settingsButton:SetActive(widget.Enabled)
end)

---------------------------------------------------------------------------
-- Zone sampling and kit

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
			-- Travel 1 stud past the bottom face so a zone sitting flush on the ground still hits it.
			local hit = workspace:Raycast(origin, Vector3.new(0, -(zone.Size.Y + 1), 0), params)
			if hit then
				table.insert(hits, { position = v3(hit.Position), normal = v3(hit.Normal) })
			end
		end
	end
	return hits
end

-- Walk a slash-separated path from `game`, e.g. "ServerStorage/GreebleKit". Nil if missing.
local function findPath(path: string): Instance?
	local node: Instance? = game
	for segment in path:gmatch("[^/]+") do
		node = if node then node:FindFirstChild(segment) else nil
	end
	if node == game then return nil end
	return node
end

local function findKit(): Instance
	local path = kitPath()
	local node = findPath(path)
	if not node then
		fail("Kit folder not found at " .. path .. ". Check the kit path in Settings.")
	end
	return node :: Instance
end

-- Box size in the Model's own frame. Never GetExtentsSize: that is the world-aligned box.
local function boxSize(model: Model): Vector3
	local _, size = model:GetBoundingBox()
	return size
end

local function readKit(kit: Instance)
	local assets, byId, sizes = {}, {}, {}
	for _, child in kit:GetChildren() do
		if child:IsA("Model") then
			local size = boxSize(child)
			table.insert(assets, { id = child.Name, footprint = math.sqrt(size.X ^ 2 + size.Z ^ 2) / 2 })
			byId[child.Name] = child
			sizes[child.Name] = size
		end
	end
	return assets, byId, sizes
end

local SHAPE_TOLERANCE = 1.15

-- The uniform factor f with size ~= kitSize * f, or nil when the three axis ratios
-- disagree by more than SHAPE_TOLERANCE (max ratio / min ratio).
local function uniformScale(size: Vector3, kitSize: Vector3): number?
	local eps = 1e-3
	local rx = size.X / math.max(kitSize.X, eps)
	local ry = size.Y / math.max(kitSize.Y, eps)
	local rz = size.Z / math.max(kitSize.Z, eps)
	local lo, hi = math.min(rx, ry, rz), math.max(rx, ry, rz)
	if lo <= 0 or hi / lo > SHAPE_TOLERANCE then return nil end
	return (rx + ry + rz) / 3
end

---------------------------------------------------------------------------
-- HTTP

-- `hints` maps an HTTP status to a message shown before the server's error string.
local function request(method: string, path: string, body: any?, hints: { [number]: string }?): any
	local url = settingString("GreebleUrl")
	local key = settingString("GreebleKey")
	if not url or not key then fail("Set the server URL and key in Settings first.") end
	local base = stripSlash(url :: string)

	local ok, res = pcall(function()
		return HttpService:RequestAsync({
			Url = base .. path,
			Method = method,
			Headers = { ["Content-Type"] = "application/json", Authorization = "Bearer " .. (key :: string) },
			Body = if body then HttpService:JSONEncode(body) else nil,
		})
	end)
	if not ok then
		fail(("Could not reach %s: %s"):format(base, tostring(res)))
	end

	if not res.Success then
		local decoded, data = pcall(HttpService.JSONDecode, HttpService, res.Body)
		local serverText = if decoded and type(data) == "table" and type(data.error) == "string" then data.error else nil
		local hint = if hints then hints[res.StatusCode] else nil
		local message
		if hint then
			message = ("%s (server: %s)"):format(hint, serverText or tostring(res.StatusMessage))
		elseif serverText then
			message = ("Server error %d: %s"):format(res.StatusCode, serverText)
		else
			message = ("Server error %d %s"):format(res.StatusCode, tostring(res.StatusMessage))
		end
		failServer(message, serverText or message)
	end

	local decoded, data = pcall(HttpService.JSONDecode, HttpService, res.Body)
	if not decoded then fail("Server sent a reply that is not JSON (" .. method .. " " .. path .. ")") end
	return data
end

local function post(path: string, body: any, hints: { [number]: string }?): any
	return request("POST", path, body, hints)
end

---------------------------------------------------------------------------
-- Dress

-- opts come from a queued job; a button click passes none.
local function dress(opts: { zone: string?, maxInstances: number?, seed: number? }?)
	local o = opts or {}
	local zoneName = o.zone or "GreebleZone"
	local zone = workspace:FindFirstChild(zoneName)
	if not (zone and zone:IsA("BasePart")) then fail("No zone Part named " .. zoneName .. " in Workspace.") end
	local kit = findKit()

	local assets, byId = readKit(kit)
	if #assets == 0 then fail("Kit folder at " .. kitPath() .. " has no Models.") end
	local keepClear = {}
	for _, part in CollectionService:GetTagged("GreebleKeepClear") do
		if part:IsA("BasePart") then table.insert(keepClear, boxOf(part)) end
	end
	local zonePart = zone :: BasePart
	local labelAttr = zonePart:GetAttribute("Label")
	local zoneLabel = if type(labelAttr) == "string" and trim(labelAttr) ~= "" then labelAttr else nil
	local result = post("/v1/place", {
		zone = { id = zonePart:GetAttribute("ZoneId") or "zone", label = zoneLabel },
		surface = sampleSurface(zonePart),
		cell = CELL,
		assets = assets,
		keepClear = keepClear,
		budget = { maxInstances = o.maxInstances or zonePart:GetAttribute("MaxInstances") or 500 },
		seed = o.seed or zonePart:GetAttribute("Seed") or 1,
	}, {
		[409] = "No style learned for this zone yet. Select a finished map and run Learn style first.",
	})

	local zoneId = tostring(zonePart:GetAttribute("ZoneId") or "zone")
	local recording = ChangeHistoryService:TryBeginRecording("Greeble: dress zone")
	local ok, err = pcall(function()
		-- Build the new output off-tree first, so a failure here leaves the old output alone.
		local folder = Instance.new("Folder")
		folder.Name = zoneId
		local count = 0
		for _, p in result.placements do
			local source = byId[p.assetId]
			if source then
				local clone = source:Clone()
				clone:ScaleTo(p.scale)
				local target = Vector3.new(p.position[1], p.position[2], p.position[3])
				-- Rotate in place first, then move so the bounding-box bottom centre sits on target.
				-- The pivot can be anywhere (centre, base, off to one side), so never place by it.
				clone:PivotTo(CFrame.new(clone:GetPivot().Position) * CFrame.Angles(0, p.rotationY, 0))
				local box, size = clone:GetBoundingBox()
				local half = size / 2
				local bottomY = math.huge
				for _, sx in { -1, 1 } do
					for _, sy in { -1, 1 } do
						for _, sz in { -1, 1 } do
							bottomY = math.min(bottomY, box:PointToWorldSpace(Vector3.new(sx * half.X, sy * half.Y, sz * half.Z)).Y)
						end
					end
				end
				local bottom = Vector3.new(box.Position.X, bottomY, box.Position.Z)
				clone:PivotTo(clone:GetPivot() + (target - bottom))
				clone.Parent = folder
				count += 1
			end
		end
		-- Nothing placed: keep whatever this zone already had.
		if count == 0 then
			folder:Destroy()
			return
		end

		local outRoot = workspace:FindFirstChild("Greeble") or Instance.new("Folder")
		outRoot.Name = "Greeble"
		outRoot.Parent = workspace
		-- Replace earlier output for this zone. Unparent rather than Destroy so undo can restore it.
		for _, child in outRoot:GetChildren() do
			if child.Name == zoneId and child:IsA("Folder") then child.Parent = nil end
		end
		folder.Parent = outRoot
	end)
	if recording then
		ChangeHistoryService:FinishRecording(
			recording,
			if ok then Enum.FinishRecordingOperation.Commit else Enum.FinishRecordingOperation.Cancel
		)
	end
	if not ok then fail("Placing instances failed: " .. tostring(err)) end

	local stats = if type(result.stats) == "table" then result.stats else {}
	local placed = stats.placed or 0
	local text
	if placed == 0 then
		text = ("Nothing placed in %s (skipped: %d keep-clear, %d overlap, %d slope)."):format(
			zoneName, stats.skippedKeepClear or 0, stats.skippedOverlap or 0, stats.skippedSlope or 0)
	else
		text = ("Placed %d instances in %s. Undo with Ctrl+Z."):format(placed, zoneName)
	end
	local tooLarge = stats.tooLarge
	if type(tooLarge) == "table" and #tooLarge > 0 then
		local ids = {}
		for _, id in tooLarge do table.insert(ids, tostring(id)) end
		text ..= " Too large for this zone: " .. table.concat(ids, ", ")
	end
	setStatus(text)
	return result.stats
end

local function dressClicked(): boolean
	setStatus("Dressing zone...")
	local ok, err = pcall(dress)
	if not ok then setStatus("Dress failed: " .. tostring(err), true) end
	return ok
end

button.Click:Connect(dressClicked)

---------------------------------------------------------------------------
-- Learn style: read the selected finished map and ask the server for a profile.

-- Collect Models under `node` that match a kit Model: same Name, and a box that is the kit
-- Model's box times one uniform factor. A matched Model is not searched further.
-- Returns how many other Models were skipped (they are still searched for kit Models inside).
local function collectInstances(node: Instance, sizes: { [string]: Vector3 }, out: { any }): number
	local unmatched = 0
	for _, child in node:GetChildren() do
		local kitSize = if child:IsA("Model") then sizes[child.Name] else nil
		local scale = if kitSize then uniformScale(boxSize(child :: Model), kitSize) else nil
		if scale then
			local model = child :: Model
			table.insert(out, {
				assetId = model.Name,
				position = v3(model:GetPivot().Position),
				scale = scale,
			})
		else
			if child:IsA("Model") then unmatched += 1 end
			unmatched += collectInstances(child, sizes, out)
		end
	end
	return unmatched
end

local function labelOf(inst: Instance): string?
	local attr = inst:GetAttribute("Label")
	return if type(attr) == "string" and trim(attr) ~= "" then attr else nil
end

type LearnStats = { zones: { string }, instances: number, unmatched: number }

-- Each source becomes one zone. `label` nil means the unlabelled ("default") style.
local function learnFrom(sources: { { node: Instance, label: string? } }): LearnStats
	for _, src in sources do
		local sel = src.node
		if not (sel:IsA("Folder") or sel:IsA("Model")) then
			fail(("%s is a %s, not a Folder or Model."):format(sel:GetFullName(), sel.ClassName))
		end
	end

	local _, _, sizes = readKit(findKit())
	local zones, names = {}, {}
	local total, unmatched = 0, 0
	for _, src in sources do
		local instances = {}
		unmatched += collectInstances(src.node, sizes, instances)
		if #instances == 0 then
			fail(("No kit Models found in %s (kit at %s)."):format(src.node:GetFullName(), kitPath()))
		end
		table.insert(zones, { label = src.label, instances = instances })
		table.insert(names, src.label or "default")
		total += #instances
	end

	local result = post("/v1/profile", { zones = zones })
	if type(result) ~= "table" or type(result.profile) ~= "table" then
		fail("Server reply has no profile.")
	end
	setStatus(("Learned style from %d instances in zones: %s."):format(total, table.concat(names, ", ")))
	return { zones = names, instances = total, unmatched = unmatched }
end

local function learn()
	local selected = Selection:Get()
	if #selected == 0 then fail("Nothing selected. Select the Folders or Models of a finished map.") end
	local sources = {}
	for _, sel in selected do
		table.insert(sources, { node = sel, label = labelOf(sel) })
	end
	learnFrom(sources)
end

-- A queued learn_profile job: params.path names the map, params.label overrides its Label attribute.
local function learnProfile(params: any): LearnStats
	local p = if type(params) == "table" then params else {}
	if type(p.path) ~= "string" or trim(p.path) == "" then fail("learn_profile needs a path string") end
	local path = stripSlash(trim(p.path))
	local node = findPath(path)
	if not node then fail("Nothing found at path " .. path) end
	local override = if type(p.label) == "string" and trim(p.label) ~= "" then p.label else nil
	return learnFrom({ { node = node :: Instance, label = override or labelOf(node :: Instance) } })
end

local function learnClicked(): boolean
	setStatus("Learning style...")
	local ok, err = pcall(learn)
	if not ok then setStatus("Learn failed: " .. tostring(err), true) end
	return ok
end

learnButton.Click:Connect(learnClicked)

---------------------------------------------------------------------------
-- Listening mode: pick up jobs queued by an agent or the chat panel.

local listening = false

local function runJob(job)
	setStatus("Running job " .. tostring(job.id) .. "...")
	local ok, out = pcall(function()
		if job.type == "dress_zone" then return dress(job.params) end
		if job.type == "learn_profile" then return learnProfile(job.params) end
		fail("unknown job type " .. tostring(job.type))
	end)
	if not ok then setStatus("Job " .. tostring(job.id) .. " failed: " .. tostring(out), true) end
	-- A failed dress reports the server's own text, so the agent can see e.g. which label has no style.
	local errText = if job.type == "dress_zone" then serverTextOf(out) or tostring(out) else tostring(out)
	local sent, sendErr = pcall(post, "/v1/jobs/" .. job.id .. "/result", {
		ok = ok,
		result = if ok then out else { error = errText },
	})
	if not sent then setStatus("Could not report job " .. tostring(job.id) .. ": " .. tostring(sendErr), true) end
end

local function setListening(on: boolean)
	if on == listening then return end
	listening = on
	listenButton:SetActive(listening)
	if not listening then
		setStatus("Stopped listening.")
		return
	end
	setStatus("Listening for jobs...")
	task.spawn(function()
		local lastError: string? = nil
		while listening do
			local ok, res = pcall(request, "GET", "/v1/jobs/next")
			if ok then
				if lastError then
					lastError = nil
					setStatus("Listening for jobs...")
				end
				if res and res.job then runJob(res.job) end
			else
				local msg = "Listen failed: " .. tostring(res)
				-- Only report a repeated error once, so Output is not flooded.
				if msg ~= lastError then
					lastError = msg
					setStatus(msg, true)
				end
			end
			task.wait(2)
		end
	end)
end

listenButton.Click:Connect(function()
	setListening(not listening)
end)

---------------------------------------------------------------------------
-- Test hook: lets an agent run the same actions from execute_luau without clicking.
-- Lives in CoreGui, so it is not saved with the place and game scripts cannot reach it.

local CoreGui = game:GetService("CoreGui")

-- Each action returns false when it reported a failure on the status line.
local actions: { [string]: (args: { [string]: any }) -> boolean } = {
	settings = function(args)
		if type(args.url) ~= "string" or type(args.key) ~= "string" then
			fail("settings needs url and key strings")
		end
		local path = args.kitPath
		if path ~= nil and type(path) ~= "string" then fail("kitPath must be a string") end
		saveSettings(args.url, args.key, path or "")
		return true
	end,
	learn = function() return learnClicked() end,
	dress = function() return dressClicked() end,
	listen = function(args)
		if type(args.on) ~= "boolean" then fail("listen needs on = true or false") end
		setListening(args.on)
		return true
	end,
	status = function() return true end,
}

local old = CoreGui:FindFirstChild("GreebleTestHook")
if old then old:Destroy() end
local testHook = Instance.new("BindableFunction")
testHook.Name = "GreebleTestHook"
testHook.Archivable = false
testHook.OnInvoke = function(action: any, args: any)
	local ran, res = pcall(function(): boolean
		local fn = if type(action) == "string" then actions[action] else nil
		if not fn then fail("unknown action " .. tostring(action)) end
		if args ~= nil and type(args) ~= "table" then fail("args must be a table") end
		return fn(args or {})
	end)
	-- A bad call is not shown on the status line; its message comes back as status instead.
	if not ran then return { ok = false, status = tostring(res) } end
	return { ok = res == true, status = statusLabel.Text }
end
testHook.Parent = CoreGui

plugin.Unloading:Connect(function()
	listening = false
	testHook:Destroy()
end)
