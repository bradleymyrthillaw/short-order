extends Node
## The kitchen arsenal.
##
## `heft` is the load-bearing number: it scales screen shake, hitstop, rumble,
## particle count and sound weight, so a cast iron pan FEELS like it weighs a ton
## and a spatula feels like a tap. Everything else here is normal combat stats.

const DATA := {
	"fists":
	{
		"name": "Bare Hands",
		"cls": "light",
		"reach": 1.05,
		"light": 5.0,
		"heavy": 9.0,
		"wind": 0.11,
		"rec": 0.15,
		"stagger": 0.30,
		"gbreak": false,
		"knock": false,
		"dur": -1,
		"heft": 0.12,
		"metal": false,
		"tint": Color("d8b38a"),
	},
	"spatula":
	{
		"name": "Spatula",
		"cls": "light",
		"reach": 1.65,
		"light": 6.0,
		"heavy": 11.0,
		"wind": 0.10,
		"rec": 0.14,
		"stagger": 0.35,
		"gbreak": false,
		"knock": false,
		"dur": 24,
		"heft": 0.20,
		"metal": true,
		"tint": Color("d7d2c4"),
	},
	"nonstick":
	{
		"name": "Nonstick Pan",
		"cls": "medium",
		"reach": 1.60,
		"light": 9.0,
		"heavy": 18.0,
		"wind": 0.17,
		"rec": 0.24,
		"stagger": 0.65,
		"gbreak": false,
		"knock": false,
		"dur": 18,
		"heft": 0.58,
		"metal": true,
		"tint": Color("2b2b2f"),
	},
	"castiron":
	{
		"name": "Cast Iron",
		"cls": "heavy",
		"reach": 1.70,
		"light": 16.0,
		"heavy": 32.0,
		"wind": 0.34,
		"rec": 0.44,
		"stagger": 1.25,
		"gbreak": true,
		"knock": true,
		"dur": 12,
		"heft": 1.00,
		"metal": true,
		"tint": Color("1a1a1c"),
	},
	"knife":
	{
		"name": "Chef's Knife",
		"cls": "light",
		"reach": 1.85,
		"light": 8.0,
		"heavy": 15.0,
		"wind": 0.10,
		"rec": 0.13,
		"stagger": 0.30,
		"gbreak": false,
		"knock": false,
		"dur": 14,
		"heft": 0.24,
		"metal": true,
		"thrust": true,
		"tint": Color("dfe6ea"),
	},
	"potlid":
	{
		"name": "Pot Lid",
		"cls": "shield",
		"reach": 1.10,
		"light": 4.0,
		"heavy": 7.0,
		"wind": 0.15,
		"rec": 0.20,
		"stagger": 0.30,
		"gbreak": false,
		"knock": false,
		"dur": 30,
		"heft": 0.30,
		"metal": true,
		"shield": true,
		"tint": Color("b9c4cc"),
	},
}


func get_weapon(key: String) -> Dictionary:
	return DATA.get(key, DATA["fists"])


func heft(key: String) -> float:
	return float(get_weapon(key).get("heft", 0.3))


func reach(key: String) -> float:
	return float(get_weapon(key).get("reach", 1.05))


func is_metal(key: String) -> bool:
	return bool(get_weapon(key).get("metal", false))
