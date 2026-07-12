
/*
 * The Nook ePOS 1.1.5 - Consolidated Google Apps Script backend
 * Deploy as a Web App and paste the Web App URL into js/config.js or Settings in the browser app.
 * This script can be bound to a Google Sheet or can create/use a spreadsheet ID stored in Script Properties.
 */

var NOOK_VERSION = '1.1.5';
var NOOK_DATABASE_VERSION = '1.0.6';
var NOOK_APP_NAME = 'The Nook ePOS';

var SEED_DATA = {
  "meta": {
    "AppName": "The Nook ePOS",
    "FrontendVersion": "1.1.5",
    "BackendVersion": "1.1.5",
    "DatabaseVersion": "1.0.6",
    "BuildDate": "2026-07-11",
    "Source": "Clean ePOS build from uploaded feature list"
  },
  "categories": [
    {
      "CategoryID": "C001",
      "CategoryName": "Breakfast",
      "Sort": 1,
      "Active": true,
      "ButtonColour": "",
      "IsDrinkCategory": false
    },
    {
      "CategoryID": "C002",
      "CategoryName": "Cold Sandwiches",
      "Sort": 2,
      "Active": true,
      "ButtonColour": "",
      "IsDrinkCategory": false
    },
    {
      "CategoryID": "C003",
      "CategoryName": "Toasted Sandwiches",
      "Sort": 3,
      "Active": true,
      "ButtonColour": "",
      "IsDrinkCategory": false
    },
    {
      "CategoryID": "C004",
      "CategoryName": "Paninis",
      "Sort": 4,
      "Active": true,
      "ButtonColour": "",
      "IsDrinkCategory": false
    },
    {
      "CategoryID": "C005",
      "CategoryName": "Drinks",
      "Sort": 5,
      "Active": true,
      "ButtonColour": "",
      "IsDrinkCategory": true
    },
    {
      "CategoryID": "C006",
      "CategoryName": "Cakes",
      "Sort": 6,
      "Active": true,
      "ButtonColour": "",
      "IsDrinkCategory": false
    },
    {
      "CategoryID": "C007",
      "CategoryName": "Extras",
      "Sort": 7,
      "Active": true,
      "ButtonColour": "",
      "IsDrinkCategory": false
    },
    {
      "CategoryID": "C008",
      "CategoryName": "Hot drinks",
      "Sort": 8,
      "Active": true,
      "ButtonColour": "",
      "IsDrinkCategory": true
    },
    {
      "CategoryID": "C009",
      "CategoryName": "Cold Drinks",
      "Sort": 9,
      "Active": true,
      "ButtonColour": "",
      "IsDrinkCategory": true
    },
    {
      "CategoryID": "C010",
      "CategoryName": "Sweet treats",
      "Sort": 10,
      "Active": true,
      "ButtonColour": "",
      "IsDrinkCategory": false
    },
    {
      "CategoryID": "C011",
      "CategoryName": "Pizza",
      "Sort": 11,
      "Active": true,
      "ButtonColour": "",
      "IsDrinkCategory": false
    }
  ],
  "menuItems": [
    {
      "ItemID": "I1782649431040",
      "CategoryID": "C001",
      "CategoryName": "Breakfast",
      "ItemName": "The Nook Full English",
      "Description": "2 bacon 2 sausage 2 egg 2 hash bean mushrooms Black pudding and toast",
      "Price": 10.95,
      "Active": true,
      "Sort": 1,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782652780758",
      "CategoryID": "C001",
      "CategoryName": "Breakfast",
      "ItemName": "Build your own breakfast Cob",
      "Description": "Bacon or sausage as standard, add egg mushrooms tomato additional 70p",
      "Price": 3.75,
      "Active": true,
      "Sort": 2,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782669643290",
      "CategoryID": "C001",
      "CategoryName": "Breakfast",
      "ItemName": "Scrambled Eggs on Toast",
      "Description": "",
      "Price": 3.5,
      "Active": true,
      "Sort": 3,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782669672463",
      "CategoryID": "C001",
      "CategoryName": "Breakfast",
      "ItemName": "Beans on Toast",
      "Description": "",
      "Price": 3.2,
      "Active": true,
      "Sort": 4,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782669740358",
      "CategoryID": "C001",
      "CategoryName": "Breakfast",
      "ItemName": "The Smashed Bagel",
      "Description": "Toasted Bagel With Smashed Avocado & Poached Egg",
      "Price": 5.95,
      "Active": true,
      "Sort": 5,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782669802819",
      "CategoryID": "C001",
      "CategoryName": "Breakfast",
      "ItemName": "The Smoked Bagel",
      "Description": "Toasted bagel with scrambled egg & Smoked salmon",
      "Price": 7.95,
      "Active": true,
      "Sort": 6,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782669845961",
      "CategoryID": "C001",
      "CategoryName": "Breakfast",
      "ItemName": "Thick Toast with Preserves V",
      "Description": "V",
      "Price": 2.4,
      "Active": true,
      "Sort": 7,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782669890055",
      "CategoryID": "C001",
      "CategoryName": "Breakfast",
      "ItemName": "Toasted Tea Cake V",
      "Description": "",
      "Price": 2.75,
      "Active": true,
      "Sort": 8,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782669980937",
      "CategoryID": "C002",
      "CategoryName": "Cold Sandwiches",
      "ItemName": "Ham",
      "Description": "",
      "Price": 5.25,
      "Active": true,
      "Sort": 9,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782669994547",
      "CategoryID": "C002",
      "CategoryName": "Cold Sandwiches",
      "ItemName": "Cheese",
      "Description": "",
      "Price": 5.25,
      "Active": true,
      "Sort": 10,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782670023537",
      "CategoryID": "C002",
      "CategoryName": "Cold Sandwiches",
      "ItemName": "Tuna Mayo",
      "Description": "",
      "Price": 5.75,
      "Active": true,
      "Sort": 11,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782670130797",
      "CategoryID": "C002",
      "CategoryName": "Cold Sandwiches",
      "ItemName": "Cheese and red onion chutney",
      "Description": "",
      "Price": 5.75,
      "Active": true,
      "Sort": 12,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782670193173",
      "CategoryID": "C002",
      "CategoryName": "Cold Sandwiches",
      "ItemName": "Ham or Cheese salad",
      "Description": "",
      "Price": 5.75,
      "Active": true,
      "Sort": 13,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782670559779",
      "CategoryID": "C003",
      "CategoryName": "Toasted Sandwiches",
      "ItemName": "Cheese & Ham",
      "Description": "",
      "Price": 6.75,
      "Active": true,
      "Sort": 14,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782670578738",
      "CategoryID": "C003",
      "CategoryName": "Toasted Sandwiches",
      "ItemName": "Cheese and red onion chutney",
      "Description": "",
      "Price": 6.75,
      "Active": true,
      "Sort": 15,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782670601704",
      "CategoryID": "C003",
      "CategoryName": "Toasted Sandwiches",
      "ItemName": "Tuna crunch and red onion",
      "Description": "",
      "Price": 6.75,
      "Active": true,
      "Sort": 16,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782671896092",
      "CategoryID": "C004",
      "CategoryName": "Paninis",
      "ItemName": "Ham & Cheese",
      "Description": "",
      "Price": 6.95,
      "Active": true,
      "Sort": 17,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782671920796",
      "CategoryID": "C004",
      "CategoryName": "Paninis",
      "ItemName": "Cheese and red onion chutney",
      "Description": "",
      "Price": 6.95,
      "Active": true,
      "Sort": 18,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782671939084",
      "CategoryID": "C004",
      "CategoryName": "Paninis",
      "ItemName": "Tuna crunch and red onion",
      "Description": "",
      "Price": 6.95,
      "Active": true,
      "Sort": 19,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782671977972",
      "CategoryID": "C004",
      "CategoryName": "Paninis",
      "ItemName": "Bacon, Brie & Cranberry",
      "Description": "",
      "Price": 8.95,
      "Active": true,
      "Sort": 20,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672072753",
      "CategoryID": "C004",
      "CategoryName": "Paninis",
      "ItemName": "Bacon and stilton",
      "Description": "",
      "Price": 8.95,
      "Active": true,
      "Sort": 21,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672112616",
      "CategoryID": "C008",
      "CategoryName": "Hot drinks",
      "ItemName": "Mug of Tea",
      "Description": "",
      "Price": 1.5,
      "Active": true,
      "Sort": 22,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672129350",
      "CategoryID": "C008",
      "CategoryName": "Hot drinks",
      "ItemName": "Pot of tea",
      "Description": "",
      "Price": 2.0,
      "Active": true,
      "Sort": 23,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672145664",
      "CategoryID": "C008",
      "CategoryName": "Hot drinks",
      "ItemName": "Instant Coffee",
      "Description": "",
      "Price": 1.5,
      "Active": true,
      "Sort": 24,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672163878",
      "CategoryID": "C008",
      "CategoryName": "Hot drinks",
      "ItemName": "Assorted Fruit tea",
      "Description": "",
      "Price": 1.5,
      "Active": true,
      "Sort": 25,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672184391",
      "CategoryID": "C008",
      "CategoryName": "Hot drinks",
      "ItemName": "Latte",
      "Description": "",
      "Price": 3.5,
      "Active": true,
      "Sort": 26,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672204530",
      "CategoryID": "C008",
      "CategoryName": "Hot drinks",
      "ItemName": "cappucino",
      "Description": "",
      "Price": 3.5,
      "Active": true,
      "Sort": 27,
      "LoyaltyEligible": true
    },
    {
      "ItemID": "I1782672220829",
      "CategoryID": "C008",
      "CategoryName": "Hot drinks",
      "ItemName": "Americano",
      "Description": "",
      "Price": 3.5,
      "Active": true,
      "Sort": 28,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672237467",
      "CategoryID": "C008",
      "CategoryName": "Hot drinks",
      "ItemName": "Mocha",
      "Description": "",
      "Price": 3.5,
      "Active": true,
      "Sort": 27,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672252677",
      "CategoryID": "C008",
      "CategoryName": "Hot drinks",
      "ItemName": "Flat White",
      "Description": "",
      "Price": 3.5,
      "Active": true,
      "Sort": 28,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672268111",
      "CategoryID": "C008",
      "CategoryName": "Hot drinks",
      "ItemName": "Esspresso",
      "Description": "",
      "Price": 3.0,
      "Active": true,
      "Sort": 29,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672296450",
      "CategoryID": "C008",
      "CategoryName": "Hot drinks",
      "ItemName": "Hot Chocolate",
      "Description": "",
      "Price": 3.5,
      "Active": true,
      "Sort": 32,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672320049",
      "CategoryID": "C009",
      "CategoryName": "Cold Drinks",
      "ItemName": "Milkshakes",
      "Description": "",
      "Price": 4.0,
      "Active": true,
      "Sort": 33,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672345976",
      "CategoryID": "C009",
      "CategoryName": "Cold Drinks",
      "ItemName": "Bottle of soft drink",
      "Description": "",
      "Price": 2.5,
      "Active": true,
      "Sort": 34,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672515745",
      "CategoryID": "C009",
      "CategoryName": "Cold Drinks",
      "ItemName": "Special Cold drink (glass bottle)",
      "Description": "",
      "Price": 2.5,
      "Active": true,
      "Sort": 35,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672569009",
      "CategoryID": "C009",
      "CategoryName": "Cold Drinks",
      "ItemName": "Bottle of Water",
      "Description": "",
      "Price": 1.5,
      "Active": true,
      "Sort": 36,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672591327",
      "CategoryID": "C009",
      "CategoryName": "Cold Drinks",
      "ItemName": "Can of Pop",
      "Description": "",
      "Price": 1.5,
      "Active": true,
      "Sort": 37,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672663601",
      "CategoryID": "C010",
      "CategoryName": "Sweet treats",
      "ItemName": "ShortBread slice",
      "Description": "",
      "Price": 3.0,
      "Active": true,
      "Sort": 38,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672688196",
      "CategoryID": "C010",
      "CategoryName": "Sweet treats",
      "ItemName": "Cake Slice",
      "Description": "",
      "Price": 3.75,
      "Active": true,
      "Sort": 39,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672707104",
      "CategoryID": "C007",
      "CategoryName": "Extras",
      "ItemName": "Sausage",
      "Description": "",
      "Price": 1.0,
      "Active": true,
      "Sort": 40,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672720488",
      "CategoryID": "C007",
      "CategoryName": "Extras",
      "ItemName": "x Bacon Extra",
      "Description": "",
      "Price": 1.0,
      "Active": true,
      "Sort": 41,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672739812",
      "CategoryID": "C007",
      "CategoryName": "Extras",
      "ItemName": "x Egg Extra",
      "Description": "",
      "Price": 1.0,
      "Active": true,
      "Sort": 41,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782672762420",
      "CategoryID": "C007",
      "CategoryName": "Extras",
      "ItemName": "Mushrooms",
      "Description": "",
      "Price": 1.0,
      "Active": true,
      "Sort": 42,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1782678920773",
      "CategoryID": "C009",
      "CategoryName": "Cold Drinks",
      "ItemName": "Shandy bass",
      "Description": "",
      "Price": 2.5,
      "Active": true,
      "Sort": 46,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "Imqzsdjw3l8nwp",
      "CategoryID": "C002",
      "CategoryName": "Cold Sandwiches",
      "ItemName": "The Daddy sandwich",
      "Description": "",
      "Price": 5.9,
      "Active": true,
      "Sort": 46,
      "LoyaltyEligible": false
    },
    {
      "ItemID": "I1783015856354672",
      "CategoryID": "C011",
      "CategoryName": "Pizza",
      "ItemName": "Category placeholder",
      "Description": "",
      "Price": 0.0,
      "Active": false,
      "Sort": 9999,
      "LoyaltyEligible": false
    }
  ],
  "prompts": [
    {
      "PromptID": "P1782656025085_933",
      "TriggerItemID": "I1782649431040",
      "PromptTitle": "toast",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782656060858_727",
      "TriggerItemID": "I1782649431040",
      "PromptTitle": "Eggs",
      "PromptType": "single",
      "Required": false,
      "Sort": 2,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782656217930_829",
      "TriggerItemID": "I1782649431040",
      "PromptTitle": "Additional item",
      "PromptType": "multi",
      "Required": true,
      "Sort": 3,
      "Active": true,
      "AllowNotes": true
    },
    {
      "PromptID": "P1782669309730_362",
      "TriggerItemID": "I1782652780758",
      "PromptTitle": "Choose bacon or sausage",
      "PromptType": "single",
      "Required": true,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782669364652_641",
      "TriggerItemID": "I1782652780758",
      "PromptTitle": "additional Cob item",
      "PromptType": "single",
      "Required": false,
      "Sort": 2,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782670248767_972",
      "TriggerItemID": "I1782670193173",
      "PromptTitle": "Ham OR Cheese",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782670291939_777",
      "TriggerItemID": "I1782670193173",
      "PromptTitle": "Add bacon?",
      "PromptType": "single",
      "Required": false,
      "Sort": 2,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782670649954_117",
      "TriggerItemID": "I1782669980937",
      "PromptTitle": "Bread choice",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782670720725_802",
      "TriggerItemID": "I1782669980937",
      "PromptTitle": "Bread type options",
      "PromptType": "single",
      "Required": false,
      "Sort": 2,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782670841986_326",
      "TriggerItemID": "I1782669994547",
      "PromptTitle": "Bread Choice",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782670896865_479",
      "TriggerItemID": "I1782669994547",
      "PromptTitle": "bread type options",
      "PromptType": "single",
      "Required": false,
      "Sort": 2,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782670988765_8",
      "TriggerItemID": "I1782670023537",
      "PromptTitle": "Bread Choice",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782671039163_411",
      "TriggerItemID": "I1782670023537",
      "PromptTitle": "Bread Type Options",
      "PromptType": "single",
      "Required": false,
      "Sort": 2,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782671103928_679",
      "TriggerItemID": "I1782670130797",
      "PromptTitle": "Bread Choice",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782671137622_875",
      "TriggerItemID": "I1782670130797",
      "PromptTitle": "Bread Type Options",
      "PromptType": "single",
      "Required": false,
      "Sort": 2,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782671214961_788",
      "TriggerItemID": "I1782670193173",
      "PromptTitle": "Bread Choice",
      "PromptType": "single",
      "Required": false,
      "Sort": 3,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782671273652_723",
      "TriggerItemID": "I1782670193173",
      "PromptTitle": "Bread type Options",
      "PromptType": "single",
      "Required": false,
      "Sort": 4,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782671547423_898",
      "TriggerItemID": "I1782670559779",
      "PromptTitle": "Bread type options",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": false,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782671625353_843",
      "TriggerItemID": "I1782670559779",
      "PromptTitle": "Bread Type Options",
      "PromptType": "single",
      "Required": false,
      "Sort": 2,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782671731427_496",
      "TriggerItemID": "I1782670578738",
      "PromptTitle": "Bread Type Options",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782671801202_159",
      "TriggerItemID": "I1782670601704",
      "PromptTitle": "Bread Type Options",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782672804167_232",
      "TriggerItemID": "I1782672739812",
      "PromptTitle": "Egg Type",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782673004962_498",
      "TriggerItemID": "I1782672184391",
      "PromptTitle": "Add syrup",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782673229331_122",
      "TriggerItemID": "I1782672204530",
      "PromptTitle": "Add Syrup",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782673368316_835",
      "TriggerItemID": "I1782672268111",
      "PromptTitle": "Double or Single",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782673424197_513",
      "TriggerItemID": "I1782672220829",
      "PromptTitle": "With Milk?",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782673521633_691",
      "TriggerItemID": "I1782672296450",
      "PromptTitle": "Cream and Marshmallows?",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782673706645_426",
      "TriggerItemID": "I1782672320049",
      "PromptTitle": "Flavour",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782673782787_326",
      "TriggerItemID": "I1782672320049",
      "PromptTitle": "Add Cream and Marshmallows?",
      "PromptType": "single",
      "Required": false,
      "Sort": 2,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782678982466_39",
      "TriggerItemID": "I1782678920773",
      "PromptTitle": "with a glass?",
      "PromptType": "single",
      "Required": true,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782732026962_42",
      "TriggerItemID": "I1782669643290",
      "PromptTitle": "Bread choice",
      "PromptType": "single",
      "Required": true,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782732082198_82",
      "TriggerItemID": "I1782669672463",
      "PromptTitle": "Bread choice",
      "PromptType": "single",
      "Required": true,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782732169490_761",
      "TriggerItemID": "I1782669845961",
      "PromptTitle": "Bread options",
      "PromptType": "single",
      "Required": true,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "Pmqzseelbp0zgy",
      "TriggerItemID": "Imqzsdjw3l8nwp",
      "PromptTitle": "Bread Type Options",
      "PromptType": "single",
      "Required": false,
      "Sort": 1,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782847529725723",
      "TriggerItemID": "Imqzsdjw3l8nwp",
      "PromptTitle": "Bread choice",
      "PromptType": "single",
      "Required": false,
      "Sort": 2,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782847529725908",
      "TriggerItemID": "Imqzsdjw3l8nwp",
      "PromptTitle": "Bread type options",
      "PromptType": "single",
      "Required": false,
      "Sort": 3,
      "Active": true,
      "AllowNotes": false
    },
    {
      "PromptID": "P1782934439024872",
      "TriggerItemID": "I1782649431040",
      "PromptTitle": "Notes",
      "PromptType": "single",
      "Required": true,
      "Sort": 4,
      "Active": false,
      "AllowNotes": false
    }
  ],
  "promptOptions": [
    {
      "OptionID": "O1782656033788_182",
      "PromptID": "P1782656025085_933",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782656040200_729",
      "PromptID": "P1782656025085_933",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782656087934_118",
      "PromptID": "P1782656060858_727",
      "OptionText": "Fried",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782656097542_809",
      "PromptID": "P1782656060858_727",
      "OptionText": "Poached",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782656106316_854",
      "PromptID": "P1782656060858_727",
      "OptionText": "Scrambled",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 3,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782656250339_531",
      "PromptID": "P1782656217930_829",
      "OptionText": "Sausage",
      "Action": "none",
      "Value": "",
      "Price": 1.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": true
    },
    {
      "OptionID": "O1782656264660_278",
      "PromptID": "P1782656217930_829",
      "OptionText": "Bacon",
      "Action": "none",
      "Value": "",
      "Price": 1.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": true
    },
    {
      "OptionID": "O1782657393822_617",
      "PromptID": "P1782656025085_933",
      "OptionText": "None",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 3,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782657403699_977",
      "PromptID": "P1782656060858_727",
      "OptionText": "none",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 4,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782657421373_446",
      "PromptID": "P1782656217930_829",
      "OptionText": "none",
      "Action": "none",
      "Value": "",
      "Price": 0.0,
      "Sort": 3,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782669322015_714",
      "PromptID": "P1782669309730_362",
      "OptionText": "Bacon",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782669337310_443",
      "PromptID": "P1782669309730_362",
      "OptionText": "Sausage",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782669397362_952",
      "PromptID": "P1782669309730_362",
      "OptionText": "Egg",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.7,
      "Sort": 3,
      "Active": false,
      "AllowValue": false
    },
    {
      "OptionID": "O1782669414566_767",
      "PromptID": "P1782669309730_362",
      "OptionText": "Mushrooms",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.7,
      "Sort": 4,
      "Active": false,
      "AllowValue": false
    },
    {
      "OptionID": "O1782669438464_561",
      "PromptID": "P1782669309730_362",
      "OptionText": "Tomatoes",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.7,
      "Sort": 5,
      "Active": false,
      "AllowValue": false
    },
    {
      "OptionID": "O1782669488167_280",
      "PromptID": "P1782656217930_829",
      "OptionText": "Egg",
      "Action": "none",
      "Value": "",
      "Price": 1.0,
      "Sort": 4,
      "Active": true,
      "AllowValue": true
    },
    {
      "OptionID": "O1782669503132_746",
      "PromptID": "P1782656217930_829",
      "OptionText": "Mushrooms",
      "Action": "none",
      "Value": "",
      "Price": 1.0,
      "Sort": 5,
      "Active": true,
      "AllowValue": true
    },
    {
      "OptionID": "O1782669542338_819",
      "PromptID": "P1782656217930_829",
      "OptionText": "tomatoes",
      "Action": "none",
      "Value": "",
      "Price": 1.0,
      "Sort": 6,
      "Active": true,
      "AllowValue": true
    },
    {
      "OptionID": "O1782669594888_756",
      "PromptID": "P1782656217930_829",
      "OptionText": "Black Pudding",
      "Action": "none",
      "Value": "",
      "Price": 1.0,
      "Sort": 7,
      "Active": true,
      "AllowValue": true
    },
    {
      "OptionID": "O1782670259685_226",
      "PromptID": "P1782670248767_972",
      "OptionText": "Ham",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782670264885_914",
      "PromptID": "P1782670248767_972",
      "OptionText": "Cheese",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782670310021_33",
      "PromptID": "P1782670291939_777",
      "OptionText": "bacon Yes",
      "Action": "Modifier",
      "Value": "",
      "Price": 1.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782670675381_793",
      "PromptID": "P1782670649954_117",
      "OptionText": "Sandwich / normal Bread",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782670698722_576",
      "PromptID": "P1782670649954_117",
      "OptionText": "Roll / Bap /Cob",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782670741471_981",
      "PromptID": "P1782670720725_802",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782670755613_941",
      "PromptID": "P1782670720725_802",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782670866545_191",
      "PromptID": "P1782670841986_326",
      "OptionText": "Normal Bread - sandwich",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782670886420_614",
      "PromptID": "P1782670841986_326",
      "OptionText": "Roll",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782670908967_978",
      "PromptID": "P1782670896865_479",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782670916881_527",
      "PromptID": "P1782670896865_479",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671005465_979",
      "PromptID": "P1782670988765_8",
      "OptionText": "Normal sandwich",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671020425_951",
      "PromptID": "P1782670988765_8",
      "OptionText": "Roll / cob",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671060229_296",
      "PromptID": "P1782671039163_411",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671115131_347",
      "PromptID": "P1782671103928_679",
      "OptionText": "Sandwich",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671120829_678",
      "PromptID": "P1782671103928_679",
      "OptionText": "Roll",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671151669_628",
      "PromptID": "P1782671137622_875",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671158523_391",
      "PromptID": "P1782671137622_875",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671235662_170",
      "PromptID": "P1782671214961_788",
      "OptionText": "Sandwich",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671248467_535",
      "PromptID": "P1782671214961_788",
      "OptionText": "Roll / cob",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671346504_491",
      "PromptID": "P1782671273652_723",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671370935_297",
      "PromptID": "P1782671273652_723",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671635116_319",
      "PromptID": "P1782671625353_843",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671642136_577",
      "PromptID": "P1782671625353_843",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671742651_752",
      "PromptID": "P1782671731427_496",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671770619_518",
      "PromptID": "P1782671731427_496",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671830845_762",
      "PromptID": "P1782671801202_159",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782671837171_697",
      "PromptID": "P1782671801202_159",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782672813731_667",
      "PromptID": "P1782672804167_232",
      "OptionText": "Scrambled",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782672824415_876",
      "PromptID": "P1782672804167_232",
      "OptionText": "Poached",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782672843284_579",
      "PromptID": "P1782672804167_232",
      "OptionText": "Fried",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 3,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673012852_66",
      "PromptID": "P1782673004962_498",
      "OptionText": "None",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673023400_398",
      "PromptID": "P1782673004962_498",
      "OptionText": "Vanilla",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.5,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673039329_247",
      "PromptID": "P1782673004962_498",
      "OptionText": "Caramel",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.5,
      "Sort": 3,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673104468_989",
      "PromptID": "P1782673004962_498",
      "OptionText": "Hazelnut",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.5,
      "Sort": 4,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673241044_768",
      "PromptID": "P1782673229331_122",
      "OptionText": "Vanilla",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.5,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673253706_168",
      "PromptID": "P1782673229331_122",
      "OptionText": "Caramel",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.5,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673264261_109",
      "PromptID": "P1782673229331_122",
      "OptionText": "Hazelnut",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.5,
      "Sort": 3,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673392809_262",
      "PromptID": "P1782673368316_835",
      "OptionText": "Double",
      "Action": "Modifier",
      "Value": "",
      "Price": 1.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673400121_243",
      "PromptID": "P1782673368316_835",
      "OptionText": "Single",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673451035_766",
      "PromptID": "P1782673424197_513",
      "OptionText": "No",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673549659_258",
      "PromptID": "P1782673521633_691",
      "OptionText": "Cream only",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.25,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673574133_670",
      "PromptID": "P1782673521633_691",
      "OptionText": "Both",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.5,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673584671_201",
      "PromptID": "P1782673521633_691",
      "OptionText": "None",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 3,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673725338_38",
      "PromptID": "P1782673706645_426",
      "OptionText": "Vanilla",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673737060_404",
      "PromptID": "P1782673706645_426",
      "OptionText": "Strawberry",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673746330_525",
      "PromptID": "P1782673706645_426",
      "OptionText": "Banana",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 3,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673757448_469",
      "PromptID": "P1782673706645_426",
      "OptionText": "Chocolate",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 4,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673799850_378",
      "PromptID": "P1782673782787_326",
      "OptionText": "Only Cream",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.25,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673816071_41",
      "PromptID": "P1782673782787_326",
      "OptionText": "Both",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.5,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782673840394_949",
      "PromptID": "P1782673782787_326",
      "OptionText": "None",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 3,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782678994386_352",
      "PromptID": "P1782678982466_39",
      "OptionText": "Yes",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782679008453_556",
      "PromptID": "P1782678982466_39",
      "OptionText": "No",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782730861176_345",
      "PromptID": "P1782669364652_641",
      "OptionText": "Egg",
      "Action": "Modifier",
      "Value": "",
      "Price": 1.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782730879722_383",
      "PromptID": "P1782669364652_641",
      "OptionText": "Tomatoes",
      "Action": "Modifier",
      "Value": "",
      "Price": 1.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782730909723_17",
      "PromptID": "P1782669364652_641",
      "OptionText": "Mushrooms",
      "Action": "Modifier",
      "Value": "",
      "Price": 1.0,
      "Sort": 3,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782731418048_568",
      "PromptID": "P1782671039163_411",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782731529956_370",
      "PromptID": "P1782670291939_777",
      "OptionText": "No",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782731761473_2",
      "PromptID": "P1782673229331_122",
      "OptionText": "None",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 4,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782732038379_753",
      "PromptID": "P1782732026962_42",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782732047420_253",
      "PromptID": "P1782732026962_42",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782732097449_56",
      "PromptID": "P1782732082198_82",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782732104233_76",
      "PromptID": "P1782732082198_82",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782732178264_642",
      "PromptID": "P1782732169490_761",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782732186219_79",
      "PromptID": "P1782732169490_761",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "Omqzseelbeylh5",
      "PromptID": "Pmqzseelbp0zgy",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "Omqzseelb1abmw",
      "PromptID": "Pmqzseelbp0zgy",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782847529725319",
      "PromptID": "P1782847529725723",
      "OptionText": "Sandwich / normal Bread",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782847529725284",
      "PromptID": "P1782847529725723",
      "OptionText": "Roll / Bap /Cob",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782847529725265",
      "PromptID": "P1782847529725908",
      "OptionText": "White",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 1,
      "Active": true,
      "AllowValue": false
    },
    {
      "OptionID": "O1782847529725592",
      "PromptID": "P1782847529725908",
      "OptionText": "Granary",
      "Action": "Modifier",
      "Value": "",
      "Price": 0.0,
      "Sort": 2,
      "Active": true,
      "AllowValue": false
    }
  ],
  "settings": {
    "StaffDiscountPercent": "10",
    "LastConfirmedScriptUrl": "",
    "LastConfirmedUrlVersion": "",
    "LastConfirmedUrlSavedAt": "",
    "LastConfirmedUrlFrontendVersion": "",
    "LastConfirmedUrlBackendVersion": "",
    "LastConfirmedUrlDatabaseVersion": ""
  },
  "nextTicketNumber": "server only",
  "heldOrders": [],
  "tickets": [],
  "ticketItems": [],
  "ticketAddOns": [],
  "refunds": [],
  "kitchenQueue": [],
  "deletedItems": []
};

var SHEET_SCHEMAS = {
  Metadata: ['Key', 'Value'],
  Settings: ['Key', 'Value'],
  Categories: ['CategoryID', 'CategoryName', 'Sort', 'Active', 'ButtonColour', 'IsDrinkCategory'],
  MenuItems: ['ItemID', 'CategoryID', 'CategoryName', 'ItemName', 'Description', 'Price', 'Active', 'Sort', 'LoyaltyEligible'],
  Prompts: ['PromptID', 'TriggerItemID', 'PromptTitle', 'PromptType', 'Required', 'Sort', 'Active', 'AllowNotes'],
  PromptOptions: ['OptionID', 'PromptID', 'OptionText', 'Action', 'Value', 'Price', 'Sort', 'Active', 'AllowValue'],
  Tickets: ['TicketID', 'TicketNumber', 'CreatedAt', 'OrderType', 'ServerName', 'TableNumber', 'CustomerName', 'Subtotal', 'AddOnTotal', 'DiscountTotal', 'Total', 'PaymentMethod', 'CashTendered', 'ChangeDue', 'Status', 'ClientRequestID', 'LoyaltyTotal'],
  TicketItems: ['TicketItemID', 'TicketID', 'ItemID', 'ItemName', 'CategoryID', 'Quantity', 'BasePrice', 'AddOnTotal', 'LineTotal', 'Note', 'Status', 'LoyaltyRedeemed', 'LoyaltyDiscount'],
  TicketAddOns: ['AddOnID', 'TicketItemID', 'TicketID', 'PromptID', 'PromptTitle', 'OptionID', 'OptionText', 'Quantity', 'UnitPrice', 'Total', 'Action'],
  KitchenQueue: ['KitchenID', 'TicketID', 'TicketNumber', 'CreatedAt', 'OrderType', 'ServerName', 'TableNumber', 'CustomerName', 'Status', 'PayloadJSON'],
  HeldOrders: ['HoldID', 'CreatedAt', 'OrderType', 'ServerName', 'TableNumber', 'CustomerName', 'PayloadJSON', 'Total'],
  Refunds: ['RefundID', 'TicketID', 'TicketNumber', 'CreatedAt', 'Amount', 'Reason', 'StaffName'],
  DeletedItems: ['DeletedID', 'DeletedAt', 'EntityType', 'EntityID', 'ParentEntityID', 'Name', 'PayloadJSON', 'DeletedBy', 'Reason'],
  AuditLog: ['EventID', 'CreatedAt', 'Action', 'Entity', 'EntityID', 'PayloadJSON']
};

var LIST_SHEETS = {
  categories: 'Categories',
  menuItems: 'MenuItems',
  prompts: 'Prompts',
  promptOptions: 'PromptOptions',
  tickets: 'Tickets',
  ticketItems: 'TicketItems',
  ticketAddOns: 'TicketAddOns',
  kitchenQueue: 'KitchenQueue',
  heldOrders: 'HeldOrders',
  refunds: 'Refunds',
  deletedItems: 'DeletedItems'
};

/**
 * Google Apps Script Web App GET entry point.
 *
 * Opening the deployed /exec URL without parameters returns a lightweight
 * health response. The POS frontend can request full data with
 * ?action=bootstrap. Keeping the no-parameter request lightweight makes it
 * easy to verify that the correct deployment is live.
 */
function doGet(e) {
  try {
    var parameters = e && e.parameter ? e.parameter : {};
    var request = {};
    Object.keys(parameters).forEach(function (key) { request[key] = parameters[key]; });
    request.action = String(request.action || 'serverInfo').trim() || 'serverInfo';
    return handleRequest_(request);
  } catch (err) {
    return json_({
      ok: false,
      versions: versionsSafe_(),
      error: 'GET request failed: ' + errorMessage_(err)
    });
  }
}

/** Google Apps Script Web App POST entry point. */
function doPost(e) {
  try {
    var contents = e && e.postData && typeof e.postData.contents === 'string'
      ? e.postData.contents
      : '{}';
    var request = contents.trim() ? JSON.parse(contents) : {};
    if (!request || Object.prototype.toString.call(request) !== '[object Object]') {
      throw new Error('Request body must be a JSON object.');
    }
    request.action = String(request.action || 'serverInfo').trim() || 'serverInfo';
    return handleRequest_(request);
  } catch (err) {
    return json_({
      ok: false,
      versions: versionsSafe_(),
      error: 'Invalid request: ' + errorMessage_(err)
    });
  }
}

function versionsSafe_() {
  return {
    AppName: NOOK_APP_NAME,
    FrontendVersion: NOOK_VERSION,
    BackendVersion: NOOK_VERSION,
    DatabaseVersion: NOOK_DATABASE_VERSION
  };
}

function errorMessage_(err) {
  if (!err) return 'Unknown error';
  return String(err.message || err.stack || err);
}

function setupDatabase() {
  var result = withLock_(function () { return repairDatabase_({ seedIfEmpty: true }); });
  return 'Nook ePOS database setup/repair complete. Spreadsheet ID: ' + getSpreadsheet_().getId() + '. Changes: ' + result.changes.length;
}

function handleRequest_(request) {
  try {
    var action = request.action || 'bootstrap';

    // Reads must not queue behind till payments or admin writes.
    // This prevents the iPads showing "Server read failed: Lock timeout" while another process is saving.
    if (action === 'bootstrap') return json_(bootstrapResponse_());
    if (action === 'serverInfo') return json_(serverInfoResponse_());
    if (action === 'kitchenSnapshot') return json_(kitchenSnapshotResponse_());
    if (action === 'menuSnapshot') return json_(menuSnapshotResponse_());

    if (action === 'setSpreadsheetId') return json_(withMaintenanceLock_(function () { return setSpreadsheetId_(request.SpreadsheetID || request.spreadsheetId); }, 'setSpreadsheetId'));
    if (action === 'clearSpreadsheetId') return json_(withMaintenanceLock_(function () { return clearSpreadsheetId_(); }, 'clearSpreadsheetId'));
    if (action === 'setupDatabase' || action === 'repairDatabase') return json_(withMaintenanceLock_(function () {
      var repair = repairDatabase_({ seedIfEmpty: true });
      return { ok: true, versions: versions_(), schema: repair, data: bootstrapData_() };
    }, action));
    if (action === 'commitTicket') return json_(commitTicket_(request.ticket));
    if (action === 'saveCategory') return json_(withWriteLock_(function () { return saveEntity_('Categories', 'CategoryID', request.category); }, 'saveCategory'));
    if (action === 'saveItem') return json_(withWriteLock_(function () { return saveEntity_('MenuItems', 'ItemID', request.item); }, 'saveItem'));
    if (action === 'savePrompt') return json_(withWriteLock_(function () { return saveEntity_('Prompts', 'PromptID', request.prompt); }, 'savePrompt'));
    if (action === 'savePromptOption') return json_(withWriteLock_(function () { return saveEntity_('PromptOptions', 'OptionID', request.option); }, 'savePromptOption'));
    if (action === 'copyItemPrompts') return json_(withWriteLock_(function () { return copyItemPrompts_(request.sourceItemId, request.targetItemId); }, 'copyItemPrompts'));
    if (action === 'archiveDeleteEntity') return json_(withMaintenanceLock_(function () { return archiveDeleteEntity_(request.entityType, request.id, request.deletedBy, request.reason); }, 'archiveDeleteEntity'));
    if (action === 'holdOrder') return json_(withWriteLock_(function () { return saveEntity_('HeldOrders', 'HoldID', request.hold); }, 'holdOrder'));
    if (action === 'deleteHeldOrder') return json_(withWriteLock_(function () { return deleteRowById_('HeldOrders', 'HoldID', request.HoldID); }, 'deleteHeldOrder'));
    if (action === 'kitchenUpdate') return json_(withWriteLock_(function () { return kitchenUpdate_(request); }, 'kitchenUpdate'));
    if (action === 'refundTicket') return json_(withWriteLock_(function () { return refundTicket_(request.refund); }, 'refundTicket'));
    if (action === 'saveSetting') return json_(withWriteLock_(function () { return saveSetting_(request.key, request.value); }, 'saveSetting'));
    if (action === 'saveConfirmedUrl') return json_(withWriteLock_(function () { return saveConfirmedUrl_(request); }, 'saveConfirmedUrl'));
    if (action === 'clearReports') return json_(withMaintenanceLock_(function () { return clearReports_(request); }, 'clearReports')); 
    return json_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return json_({ ok: false, error: err && err.stack ? err.stack : String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function bootstrapResponse_() {
  // Bootstrap is a read path. It may opportunistically repair metadata/schema,
  // but it must never fail just because another till is saving.
  var repair = nonBlockingRepairForRead_();
  return { ok: true, versions: versions_(), schema: repair, data: bootstrapData_() };
}

function serverInfoResponse_() {
  var repair = nonBlockingRepairForRead_();
  return { ok: true, versions: versions_(), schema: repair };
}

function nonBlockingRepairForRead_() {
  var status = schemaStatus_();
  var metadataReady = false;
  if (status.ok) {
    metadataReady = String(getMetaReadOnly_('BackendVersion') || '') === String(NOOK_VERSION) && String(getMetaReadOnly_('DatabaseVersion') || '') === String(NOOK_DATABASE_VERSION);
  }
  if (status.ok && metadataReady) return { ok: true, repaired: false, changes: [], status: status, skipped: false, mode: 'read-only' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(750)) {
    return {
      ok: true,
      repaired: false,
      skipped: true,
      changes: ['Repair skipped because another till is currently writing. Reads are allowed to continue.'],
      status: status,
      mode: 'read-only-skip-repair'
    };
  }
  try {
    return repairDatabase_({ seedIfEmpty: false });
  } finally {
    lock.releaseLock();
  }
}

function withWriteLock_(fn, label) {
  return withLock_(fn, { waitMs: 30000, label: label || 'write' });
}

function withMaintenanceLock_(fn, label) {
  return withLock_(fn, { waitMs: 30000, label: label || 'maintenance' });
}

function withLock_(fn, options) {
  options = options || {};
  var waitMs = Number(options.waitMs || 30000);
  var label = String(options.label || 'write');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(waitMs)) {
    throw new Error('Server busy: another till or database repair is saving. Retry in a few seconds. Lock action: ' + label);
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var active = null;
  try { active = SpreadsheetApp.getActiveSpreadsheet(); } catch (err) { active = null; }
  if (active) {
    props.setProperty('SPREADSHEET_ID', active.getId());
    return active;
  }
  var ss = SpreadsheetApp.create('Nook ePOS Database 1.0.6');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function setSpreadsheetId_(id) {
  id = String(id || '').trim();
  if (!id) throw new Error('Missing SpreadsheetID');
  var ss = SpreadsheetApp.openById(id);
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  var repair = repairDatabase_({ seedIfEmpty: false });
  return { ok: true, versions: versions_(), schema: repair, spreadsheetId: ss.getId(), spreadsheetName: ss.getName() };
}

function clearSpreadsheetId_() {
  PropertiesService.getScriptProperties().deleteProperty('SPREADSHEET_ID');
  var ss = getSpreadsheet_();
  var repair = repairDatabase_({ seedIfEmpty: false });
  return { ok: true, versions: versions_(), schema: repair, spreadsheetId: ss.getId(), spreadsheetName: ss.getName() };
}

function setupSheets_() {
  return repairDatabase_({ seedIfEmpty: false });
}

function repairDatabase_(options) {
  options = options || {};
  var changes = [];
  var ss = getSpreadsheet_();

  Object.keys(SHEET_SCHEMAS).forEach(function (name) {
    var result = ensureSheetSchema_(name, ss);
    changes = changes.concat(result.changes);
  });

  if (setMetaIfChanged_('AppName', NOOK_APP_NAME)) changes.push('Metadata.AppName updated');
  if (setMetaIfChanged_('BackendVersion', NOOK_VERSION)) changes.push('Metadata.BackendVersion updated to ' + NOOK_VERSION);
  if (setMetaIfChanged_('DatabaseVersion', NOOK_DATABASE_VERSION)) changes.push('Metadata.DatabaseVersion updated to ' + NOOK_DATABASE_VERSION);
  if (!getMeta_('NextTicketNumber')) { setMeta_('NextTicketNumber', '1'); changes.push('Metadata.NextTicketNumber created'); }
  if (getSetting_('StaffDiscountPercent') === '') { saveSetting_('StaffDiscountPercent', '10'); changes.push('Settings.StaffDiscountPercent defaulted to 10'); }
  ['LastConfirmedScriptUrl','LastConfirmedUrlVersion','LastConfirmedUrlSavedAt','LastConfirmedUrlFrontendVersion','LastConfirmedUrlBackendVersion','LastConfirmedUrlDatabaseVersion'].forEach(function (key) {
    if (getSetting_(key) === '') { saveSetting_(key, ''); changes.push('Settings.' + key + ' created'); }
  });

  if (options.seedIfEmpty) {
    changes = changes.concat(seedIfEmpty_() || []);
  }

  var status = schemaStatus_();
  return { ok: true, repaired: changes.length > 0, changes: changes, status: status };
}

function ensureSheetSchema_(name, ss) {
  ss = ss || getSpreadsheet_();
  var changes = [];
  var desired = SHEET_SCHEMAS[name];
  if (!desired) throw new Error('Unknown sheet schema: ' + name);

  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, desired.length).setValues([desired]);
    sheet.setFrozenRows(1);
    changes.push('Created sheet ' + name);
    return { sheet: sheet, headers: desired.slice(), changes: changes };
  }

  var headers = getHeaderRow_(sheet);
  var hasAnyHeader = headers.some(function (h) { return String(h || '').trim() !== ''; });
  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, desired.length).setValues([desired]);
    sheet.setFrozenRows(1);
    changes.push('Created header row for ' + name);
    return { sheet: sheet, headers: desired.slice(), changes: changes };
  }

  var existing = {};
  headers.forEach(function (h) { if (h) existing[String(h)] = true; });
  var missing = desired.filter(function (h) { return !existing[h]; });
  if (missing.length) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
    changes.push('Added missing column(s) to ' + name + ': ' + missing.join(', '));
  }

  sheet.setFrozenRows(1);
  return { sheet: sheet, headers: headers, changes: changes };
}

function schemaStatus_() {
  var ss = getSpreadsheet_();
  var sheets = {};
  Object.keys(SHEET_SCHEMAS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheets[name] = { exists: false, missingColumns: SHEET_SCHEMAS[name].slice(), extraColumns: [], rowCount: 0 };
      return;
    }
    var headers = getHeaderRow_(sheet);
    var headerSet = {};
    headers.forEach(function (h) { if (h) headerSet[String(h)] = true; });
    var desiredSet = {};
    SHEET_SCHEMAS[name].forEach(function (h) { desiredSet[h] = true; });
    var missing = SHEET_SCHEMAS[name].filter(function (h) { return !headerSet[h]; });
    var extra = headers.filter(function (h) { return h && !desiredSet[h]; });
    sheets[name] = { exists: true, missingColumns: missing, extraColumns: extra, rowCount: Math.max(0, sheet.getLastRow() - 1), columnCount: sheet.getLastColumn() };
  });
  return { ok: Object.keys(sheets).every(function (name) { return sheets[name].exists && sheets[name].missingColumns.length === 0; }), sheets: sheets };
}

function getHeaderRow_(sheet) {
  var lastCol = Math.max(1, sheet.getLastColumn());
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
}

function sheetHeaders_(sheetName, ensure) {
  var sheet = getSheet_(sheetName);
  var result = ensure ? ensureSheetSchema_(sheetName) : { sheet: sheet, headers: getHeaderRow_(sheet), changes: [] };
  var desired = SHEET_SCHEMAS[sheetName] || [];
  var headers = result.headers && result.headers.length ? result.headers : desired.slice();
  return headers;
}

function headerIndex_(headers, field) {
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]) === String(field)) return i;
  }
  return -1;
}

function setMetaIfChanged_(key, value) {
  if (String(getMeta_(key) || '') === String(value)) return false;
  setMeta_(key, value);
  return true;
}

function seedIfEmpty_() {
  var changes = [];
  if (rowsToObjects_('Categories').length === 0) { appendObjects_('Categories', SEED_DATA.categories || []); changes.push('Seeded default Categories'); }
  if (rowsToObjects_('MenuItems').length === 0) { appendObjects_('MenuItems', SEED_DATA.menuItems || []); changes.push('Seeded default MenuItems'); }
  if (rowsToObjects_('Prompts').length === 0) { appendObjects_('Prompts', SEED_DATA.prompts || []); changes.push('Seeded default Prompts'); }
  if (rowsToObjects_('PromptOptions').length === 0) { appendObjects_('PromptOptions', SEED_DATA.promptOptions || []); changes.push('Seeded default PromptOptions'); }
  Object.keys(SEED_DATA.settings || {}).forEach(function (key) {
    if (!getSetting_(key)) { saveSetting_(key, SEED_DATA.settings[key]); changes.push('Seeded setting ' + key); }
  });
  return changes;
}

function versions_() {
  var ss = getSpreadsheet_();
  return {
    AppName: getMetaReadOnly_('AppName') || NOOK_APP_NAME,
    BackendVersion: NOOK_VERSION,
    DatabaseVersion: getMetaReadOnly_('DatabaseVersion') || NOOK_DATABASE_VERSION,
    NextTicketNumber: getMetaReadOnly_('NextTicketNumber') || '1',
    SpreadsheetID: ss.getId(),
    SpreadsheetName: ss.getName(),
    SpreadsheetUrl: ss.getUrl()
  };
}


function kitchenSnapshotResponse_() {
  return {
    ok: true,
    data: {
      kitchenQueue: rowsToObjects_('KitchenQueue'),
      serverTime: new Date().toISOString()
    }
  };
}

function menuSnapshotResponse_() {
  return {
    ok: true,
    data: {
      categories: rowsToObjects_('Categories'),
      menuItems: rowsToObjects_('MenuItems'),
      prompts: rowsToObjects_('Prompts'),
      promptOptions: rowsToObjects_('PromptOptions'),
      deletedItems: rowsToObjects_('DeletedItems'),
      serverTime: new Date().toISOString()
    }
  };
}

function clearReports_(request) {
  if (String(request.passcode || '').trim() !== '2702') {
    throw new Error('The report-clear passcode is incorrect. Hint: Wiesheu.');
  }
  ['Tickets','TicketItems','TicketAddOns','Refunds','KitchenQueue'].forEach(function (sheetName) {
    var sheet = getSheet_(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  });
  setMeta_('NextTicketNumber', '0');
  appendAudit_('CLEAR_ALL_REPORTS', 'Reports', 'ALL', { resetTicketCounterTo: 0, clearedAt: new Date().toISOString() });
  return { ok: true, nextTicketNumber: 0 };
}

function bootstrapData_() {
  var data = { meta: versions_(), settings: settingsObject_(), nextTicketNumber: getMeta_('NextTicketNumber') || '1' };
  Object.keys(LIST_SHEETS).forEach(function (key) { data[key] = rowsToObjects_(LIST_SHEETS[key]); });
  return data;
}

function getSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet: ' + name);
  return sheet;
}

function rowsToObjects_(sheetName) {
  var sheet = getSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  var headers = sheetHeaders_(sheetName, false);
  if (lastRow < 2 || headers.length === 0) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.filter(function (row) { return row.some(function (cell) { return cell !== '' && cell != null; }); }).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { if (h) obj[h] = coerce_(h, row[i]); });
    (SHEET_SCHEMAS[sheetName] || []).forEach(function (h) { if (obj[h] == null) obj[h] = ''; });
    return obj;
  });
}

function coerce_(field, value) {
  if (value instanceof Date) return value.toISOString();
  if (['Active', 'Required', 'AllowNotes', 'AllowValue', 'LoyaltyEligible', 'IsDrinkCategory', 'LoyaltyRedeemed'].indexOf(field) >= 0) return value === true || String(value).toLowerCase() === 'true' || value === 1 || value === '1';
  if (['Sort', 'Price', 'TicketNumber', 'Subtotal', 'AddOnTotal', 'DiscountTotal', 'Total', 'LoyaltyTotal', 'CashTendered', 'ChangeDue', 'Quantity', 'BasePrice', 'LineTotal', 'LoyaltyDiscount', 'UnitPrice', 'Amount'].indexOf(field) >= 0) {
    if (value === '' || value == null) return '';
    var n = Number(value);
    return isNaN(n) ? value : n;
  }
  return value == null ? '' : value;
}

function appendObjects_(sheetName, objects) {
  if (!objects || !objects.length) return;
  var sheet = getSheet_(sheetName);
  var headers = sheetHeaders_(sheetName, true);
  var rows = objects.map(function (obj) { return headers.map(function (h) { return obj[h] == null ? '' : obj[h]; }); });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}


function copyItemPrompts_(sourceItemId, targetItemId) {
  if (!sourceItemId || !targetItemId) throw new Error('Source and target item IDs are required.');
  if (String(sourceItemId) === String(targetItemId)) throw new Error('Source and target items must be different.');
  var sourceItem = findObjectById_('MenuItems', 'ItemID', sourceItemId);
  var targetItem = findObjectById_('MenuItems', 'ItemID', targetItemId);
  if (!sourceItem) throw new Error('Source menu item was not found.');
  if (!targetItem) throw new Error('Target menu item was not found.');
  var sourcePrompts = rowsToObjects_('Prompts').filter(function (p) { return String(p.TriggerItemID) === String(sourceItemId); });
  if (!sourcePrompts.length) throw new Error('The selected source item has no prompts.');
  var allOptions = rowsToObjects_('PromptOptions');
  var copiedPrompts = [];
  var copiedOptions = [];
  sourcePrompts.sort(function (a, b) { return Number(a.Sort || 0) - Number(b.Sort || 0); }).forEach(function (sourcePrompt) {
    var newPromptId = uid_('P');
    var newPrompt = Object.assign({}, sourcePrompt, { PromptID: newPromptId, TriggerItemID: targetItemId });
    copiedPrompts.push(newPrompt);
    allOptions.filter(function (o) { return String(o.PromptID) === String(sourcePrompt.PromptID); }).sort(function (a, b) { return Number(a.Sort || 0) - Number(b.Sort || 0); }).forEach(function (sourceOption) {
      copiedOptions.push(Object.assign({}, sourceOption, { OptionID: uid_('O'), PromptID: newPromptId }));
    });
  });
  appendObjects_('Prompts', copiedPrompts);
  appendObjects_('PromptOptions', copiedOptions);
  appendAudit_('COPY_PROMPTS', 'MenuItems', targetItemId, { sourceItemId: sourceItemId, targetItemId: targetItemId, promptCount: copiedPrompts.length, optionCount: copiedOptions.length });
  return { ok: true, prompts: copiedPrompts, options: copiedOptions, promptCount: copiedPrompts.length, optionCount: copiedOptions.length };
}

function saveEntity_(sheetName, idField, obj) {
  if (!obj || !obj[idField]) throw new Error('Missing ' + idField);
  upsertObject_(sheetName, idField, obj);
  appendAudit_('SAVE', sheetName, obj[idField], obj);
  return { ok: true, saved: obj };
}

function upsertObject_(sheetName, idField, obj) {
  var sheet = getSheet_(sheetName);
  var headers = sheetHeaders_(sheetName, true);
  var idIndex = headerIndex_(headers, idField);
  var idCol = idIndex + 1;
  if (idCol < 1) throw new Error('ID field not in schema: ' + idField);
  var lastRow = sheet.getLastRow();
  var targetRow = 0;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(obj[idField])) { targetRow = i + 2; break; }
    }
  }
  var existingRow = targetRow ? sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0] : [];
  var row = headers.map(function (h, i) {
    return Object.prototype.hasOwnProperty.call(obj, h) ? (obj[h] == null ? '' : obj[h]) : (existingRow[i] == null ? '' : existingRow[i]);
  });
  if (targetRow) sheet.getRange(targetRow, 1, 1, headers.length).setValues([row]);
  else sheet.getRange(lastRow + 1, 1, 1, headers.length).setValues([row]);
}

function updateById_(sheetName, idField, id, patch) {
  if (!id) throw new Error('Missing ID for update');
  var objects = rowsToObjects_(sheetName);
  var existing = objects.filter(function (o) { return String(o[idField]) === String(id); })[0];
  if (!existing) throw new Error('Cannot find ' + id + ' in ' + sheetName);
  var updated = Object.assign(existing, patch || {});
  upsertObject_(sheetName, idField, updated);
  appendAudit_('UPDATE', sheetName, id, patch);
  return { ok: true, saved: updated };
}

function deleteRowById_(sheetName, idField, id) {
  if (!id) throw new Error('Missing ID for delete');
  var sheet = getSheet_(sheetName);
  var headers = sheetHeaders_(sheetName, true);
  var idCol = headerIndex_(headers, idField) + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(id)) {
        sheet.deleteRow(i + 2);
        appendAudit_('DELETE', sheetName, id, {});
        return { ok: true, deleted: id };
      }
    }
  }
  return { ok: true, deleted: false };
}

function displayNameForDeleted_(sheetName, obj) {
  if (!obj) return '';
  if (sheetName === 'MenuItems') return obj.ItemName || obj.ItemID || '';
  if (sheetName === 'Prompts') return obj.PromptTitle || obj.PromptID || '';
  if (sheetName === 'PromptOptions') return obj.OptionText || obj.OptionID || '';
  if (sheetName === 'Categories') return obj.CategoryName || obj.CategoryID || '';
  return obj.Name || obj.ID || '';
}

function findObjectById_(sheetName, idField, id) {
  return rowsToObjects_(sheetName).filter(function (row) { return String(row[idField]) === String(id); })[0] || null;
}

function appendDeletedArchive_(sheetName, idField, obj, parentId, deletedBy, reason) {
  if (!obj || !obj[idField]) return null;
  var deleted = {
    DeletedID: uid_('D'),
    DeletedAt: new Date().toISOString(),
    EntityType: sheetName,
    EntityID: obj[idField],
    ParentEntityID: parentId || '',
    Name: displayNameForDeleted_(sheetName, obj),
    PayloadJSON: JSON.stringify(obj || {}),
    DeletedBy: deletedBy || '',
    Reason: reason || ''
  };
  appendObjects_('DeletedItems', [deleted]);
  appendAudit_('ARCHIVE_DELETE', sheetName, obj[idField], deleted);
  return deleted;
}

function archiveDeleteEntity_(entityType, id, deletedBy, reason) {
  entityType = String(entityType || '').trim();
  id = String(id || '').trim();
  if (!id) throw new Error('Missing id for delete');
  var deletedItems = [];
  var deletedRecords = [];

  function archiveAndDelete(sheetName, idField, recordId, parentId) {
    var obj = findObjectById_(sheetName, idField, recordId);
    if (!obj) return;
    var archived = appendDeletedArchive_(sheetName, idField, obj, parentId, deletedBy, reason);
    if (archived) deletedItems.push(archived);
    deleteRowById_(sheetName, idField, recordId);
    deletedRecords.push({ sheet: sheetName, idField: idField, id: recordId });
  }

  if (entityType === 'MenuItem') {
    var item = findObjectById_('MenuItems', 'ItemID', id);
    if (!item) return { ok: true, deleted: false, deletedItems: [], deletedRecords: [] };
    var prompts = rowsToObjects_('Prompts').filter(function (p) { return String(p.TriggerItemID) === String(id); });
    prompts.forEach(function (prompt) {
      rowsToObjects_('PromptOptions').filter(function (o) { return String(o.PromptID) === String(prompt.PromptID); }).forEach(function (option) {
        archiveAndDelete('PromptOptions', 'OptionID', option.OptionID, prompt.PromptID);
      });
      archiveAndDelete('Prompts', 'PromptID', prompt.PromptID, id);
    });
    archiveAndDelete('MenuItems', 'ItemID', id, '');
  } else if (entityType === 'Prompt') {
    var promptObj = findObjectById_('Prompts', 'PromptID', id);
    if (!promptObj) return { ok: true, deleted: false, deletedItems: [], deletedRecords: [] };
    rowsToObjects_('PromptOptions').filter(function (o) { return String(o.PromptID) === String(id); }).forEach(function (option) {
      archiveAndDelete('PromptOptions', 'OptionID', option.OptionID, id);
    });
    archiveAndDelete('Prompts', 'PromptID', id, promptObj.TriggerItemID || '');
  } else if (entityType === 'PromptOption') {
    var optionObj = findObjectById_('PromptOptions', 'OptionID', id);
    if (!optionObj) return { ok: true, deleted: false, deletedItems: [], deletedRecords: [] };
    archiveAndDelete('PromptOptions', 'OptionID', id, optionObj.PromptID || '');
  } else {
    throw new Error('Unsupported delete entity type: ' + entityType);
  }

  return { ok: true, deleted: deletedRecords.length > 0, deletedItems: deletedItems, deletedRecords: deletedRecords };
}

function saveConfirmedUrl_(request) {
  var url = String(request && request.url || '').trim();
  if (!url) throw new Error('Missing confirmed URL');
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(url)) throw new Error('Confirmed URL must be the deployed Google Apps Script /exec URL.');
  var frontend = String(request.frontendVersion || '').trim();
  var backend = String(request.backendVersion || NOOK_VERSION).trim();
  var database = String(request.databaseVersion || NOOK_DATABASE_VERSION).trim();
  var version = String(request.version || ('Frontend ' + frontend + ' / Backend ' + backend + ' / Database ' + database)).trim();
  var savedAt = new Date().toISOString();
  saveSetting_('LastConfirmedScriptUrl', url);
  saveSetting_('LastConfirmedUrlVersion', version);
  saveSetting_('LastConfirmedUrlSavedAt', savedAt);
  saveSetting_('LastConfirmedUrlFrontendVersion', frontend);
  saveSetting_('LastConfirmedUrlBackendVersion', backend);
  saveSetting_('LastConfirmedUrlDatabaseVersion', database);
  appendAudit_('SAVE_CONFIRMED_URL', 'Settings', 'LastConfirmedScriptUrl', { url: url, version: version, savedAt: savedAt });
  return { ok: true, settings: settingsObject_() };
}

function commitTicket_(payload) {
  if (!payload || !payload.cart || !payload.cart.length) throw new Error('Cannot commit an empty ticket.');
  if (!payload.payment || ['Cash', 'Card'].indexOf(payload.payment.method) < 0) throw new Error('Payment method must be Cash or Card.');

  return withWriteLock_(function () {
    var meta = payload.meta || {};
    var clientRequestId = String(payload.clientRequestId || meta.ClientRequestID || '').trim();
    if (clientRequestId) {
      var existing = ticketBundleByClientRequestId_(clientRequestId);
      if (existing) return existing;
    }
    var now = new Date().toISOString();
    var ticketNumber = nextTicketNumber_();
    var ticketId = uid_('T');
    var payment = payload.payment || {};
    var staffDiscountApplied = truthy_(meta.StaffDiscountApplied);
    var staffDiscountPercent = staffDiscountApplied ? clampPercent_(getSetting_('StaffDiscountPercent') || meta.StaffDiscountPercent || 0) : 0;
    var loyaltyMap = loyaltyEligibilityMap_();
    validateLoyaltyRedemptions_(payload.cart, loyaltyMap);
    var totals = calculateTotals_(payload.cart, { StaffDiscountApplied: staffDiscountApplied, StaffDiscountPercent: staffDiscountPercent }, loyaltyMap);
    var cashTendered = payment.method === 'Cash' ? money_(payment.cashTendered) : '';
    if (payment.method === 'Cash' && cashTendered < totals.total) throw new Error('Cash tendered is less than the discounted ticket total.');
    var changeDue = payment.method === 'Cash' ? Math.max(0, money_(cashTendered - totals.total)) : 0;
    var ticket = {
      TicketID: ticketId,
      TicketNumber: ticketNumber,
      CreatedAt: now,
      OrderType: meta.OrderType || '',
      ServerName: meta.ServerName || '',
      TableNumber: meta.TableNumber || '',
      CustomerName: meta.CustomerName || '',
      Subtotal: money_(totals.subtotal),
      AddOnTotal: money_(totals.addOnTotal),
      DiscountTotal: money_(totals.discountTotal || 0),
      Total: money_(totals.total),
      PaymentMethod: payment.method,
      CashTendered: cashTendered,
      ChangeDue: changeDue,
      Status: 'PAID',
      ClientRequestID: clientRequestId,
      LoyaltyTotal: money_(totals.loyaltyTotal || 0)
    };

    var ticketItems = [];
    var ticketAddOns = [];
    payload.cart.forEach(function (line) {
      var ticketItemId = uid_('TI');
      var lineQty = Number(line.Quantity || 1);
      var unitAddOnTotal = (line.AddOns || []).reduce(function (s, addon) { return s + Number(addon.Quantity || 1) * Number(addon.UnitPrice || 0); }, 0);
      var lineTotal = money_((Number(line.BasePrice || 0) + unitAddOnTotal) * lineQty);
      var loyaltyQty = loyaltyQuantity_(line, loyaltyMap);
      var loyaltyDiscount = money_((Number(line.BasePrice || 0) + unitAddOnTotal) * loyaltyQty);
      ticketItems.push({
        TicketItemID: ticketItemId,
        TicketID: ticketId,
        ItemID: line.ItemID || '',
        ItemName: line.ItemName || '',
        CategoryID: line.CategoryID || '',
        Quantity: lineQty,
        BasePrice: money_(line.BasePrice || 0),
        AddOnTotal: money_(unitAddOnTotal * lineQty),
        LineTotal: lineTotal,
        Note: line.Note || '',
        Status: 'OPEN',
        LoyaltyRedeemed: loyaltyDiscount > 0,
        LoyaltyDiscount: loyaltyDiscount
      });
      (line.AddOns || []).forEach(function (addon) {
        var qty = Number(addon.Quantity || 1) * lineQty;
        ticketAddOns.push({
          AddOnID: uid_('TA'),
          TicketItemID: ticketItemId,
          TicketID: ticketId,
          PromptID: addon.PromptID || '',
          PromptTitle: addon.PromptTitle || '',
          OptionID: addon.OptionID || '',
          OptionText: addon.OptionText || '',
          Quantity: qty,
          UnitPrice: money_(addon.UnitPrice || 0),
          Total: money_(qty * Number(addon.UnitPrice || 0)),
          Action: addon.Action || 'Modifier'
        });
      });
    });

    appendObjects_('Tickets', [ticket]);
    appendObjects_('TicketItems', ticketItems);
    appendObjects_('TicketAddOns', ticketAddOns);

    var kitchenPayload = kitchenPayload_(ticket, ticketItems, ticketAddOns);
    var kitchen = {
      KitchenID: uid_('K'),
      TicketID: ticketId,
      TicketNumber: ticketNumber,
      CreatedAt: now,
      OrderType: ticket.OrderType,
      ServerName: ticket.ServerName,
      TableNumber: ticket.TableNumber,
      CustomerName: ticket.CustomerName,
      Status: 'OPEN',
      PayloadJSON: JSON.stringify(kitchenPayload)
    };
    appendObjects_('KitchenQueue', [kitchen]);
    appendAudit_('COMMIT_TICKET', 'Tickets', ticketId, { ticket: ticket, ticketItems: ticketItems, ticketAddOns: ticketAddOns });
    return { ok: true, data: { ticket: ticket, ticketItems: ticketItems, ticketAddOns: ticketAddOns, kitchen: kitchen } };
  }, 'commitTicket');
}

function ticketBundleByClientRequestId_(clientRequestId) {
  var tickets = rowsToObjects_('Tickets');
  var ticket = tickets.filter(function (t) { return String(t.ClientRequestID || '') === String(clientRequestId); })[0];
  if (!ticket) return null;
  var ticketItems = rowsToObjects_('TicketItems').filter(function (item) { return String(item.TicketID) === String(ticket.TicketID); });
  var ticketAddOns = rowsToObjects_('TicketAddOns').filter(function (addon) { return String(addon.TicketID) === String(ticket.TicketID); });
  var kitchen = rowsToObjects_('KitchenQueue').filter(function (k) { return String(k.TicketID) === String(ticket.TicketID); })[0] || null;
  return { ok: true, duplicate: true, data: { ticket: ticket, ticketItems: ticketItems, ticketAddOns: ticketAddOns, kitchen: kitchen } };
}

function nextTicketNumber_() {
  var n = Number(getMeta_('NextTicketNumber') || '1');
  setMeta_('NextTicketNumber', String(n + 1));
  return n;
}

function loyaltyEligibilityMap_() {
  var map = {};
  rowsToObjects_('MenuItems').forEach(function (item) {
    map[String(item.ItemID || '')] = truthy_(item.LoyaltyEligible);
  });
  return map;
}

function loyaltyQuantity_(line, loyaltyMap) {
  if (!truthy_(line.LoyaltyRedeemed)) return 0;
  var itemId = String(line.ItemID || '');
  if (!loyaltyMap || !loyaltyMap[itemId]) return 0;
  var qty = Math.max(1, Number(line.Quantity || 1));
  var loyaltyQty = Math.max(1, Number(line.LoyaltyQuantity || 1));
  return Math.min(qty, loyaltyQty);
}

function validateLoyaltyRedemptions_(cart, loyaltyMap) {
  (cart || []).forEach(function (line) {
    if (truthy_(line.LoyaltyRedeemed) && !loyaltyMap[String(line.ItemID || '')]) {
      throw new Error('Loyalty cannot be applied because "' + (line.ItemName || 'this item') + '" is not marked Loyalty eligible in Menu Admin.');
    }
  });
}

function calculateTotals_(cart, discountOptions, loyaltyMap) {
  var subtotal = 0;
  var addOnTotal = 0;
  var loyaltyTotal = 0;
  (cart || []).forEach(function (line) {
    var qty = Number(line.Quantity || 1);
    var unitAddOnTotal = (line.AddOns || []).reduce(function (s, a) { return s + Number(a.Quantity || 1) * Number(a.UnitPrice || 0); }, 0);
    subtotal += Number(line.BasePrice || 0) * qty;
    addOnTotal += unitAddOnTotal * qty;
    loyaltyTotal += (Number(line.BasePrice || 0) + unitAddOnTotal) * loyaltyQuantity_(line, loyaltyMap || {});
  });
  subtotal = money_(subtotal);
  addOnTotal = money_(addOnTotal);
  loyaltyTotal = money_(loyaltyTotal);
  var grossTotal = money_(subtotal + addOnTotal);
  var afterLoyaltyTotal = money_(Math.max(0, grossTotal - loyaltyTotal));
  var percent = truthy_((discountOptions || {}).StaffDiscountApplied) ? clampPercent_((discountOptions || {}).StaffDiscountPercent || 0) : 0;
  var discountTotal = percent ? money_(afterLoyaltyTotal * percent / 100) : 0;
  return { subtotal: subtotal, addOnTotal: addOnTotal, grossTotal: grossTotal, loyaltyTotal: loyaltyTotal, afterLoyaltyTotal: afterLoyaltyTotal, discountPercent: percent, discountTotal: discountTotal, total: money_(Math.max(0, afterLoyaltyTotal - discountTotal)) };
}

function kitchenPayload_(ticket, items, addons) {
  return {
    TicketID: ticket.TicketID,
    TicketNumber: ticket.TicketNumber,
    CreatedAt: ticket.CreatedAt,
    OrderType: ticket.OrderType,
    ServerName: ticket.ServerName,
    TableNumber: ticket.TableNumber,
    CustomerName: ticket.CustomerName,
    Items: items.map(function (item) {
      var row = Object.assign({}, item);
      row.AddOns = addons.filter(function (a) { return a.TicketItemID === item.TicketItemID; });
      return row;
    })
  };
}


function kitchenUpdate_(request) {
  if (!request || !request.KitchenID) throw new Error('Missing KitchenID');
  var patch = { Status: request.Status || 'COMPLETE' };
  if (request.PayloadJSON != null) patch.PayloadJSON = String(request.PayloadJSON || '{}');
  return updateById_('KitchenQueue', 'KitchenID', request.KitchenID, patch);
}

function refundTicket_(refund) {
  if (!refund || !refund.RefundID) throw new Error('Missing refund payload');
  appendObjects_('Refunds', [refund]);
  appendAudit_('REFUND', 'Refunds', refund.RefundID, refund);
  return { ok: true, saved: refund };
}

function appendAudit_(action, entity, entityId, payload) {
  appendObjects_('AuditLog', [{
    EventID: uid_('A'),
    CreatedAt: new Date().toISOString(),
    Action: action,
    Entity: entity,
    EntityID: entityId,
    PayloadJSON: JSON.stringify(payload || {})
  }]);
}

function getMeta_(key) { return getKeyValue_('Metadata', key); }
function getMetaReadOnly_(key) { return getKeyValueReadOnly_('Metadata', key); }
function setMeta_(key, value) { return setKeyValue_('Metadata', key, value); }
function getSetting_(key) { return getKeyValue_('Settings', key); }
function getSettingReadOnly_(key) { return getKeyValueReadOnly_('Settings', key); }
function saveSetting_(key, value) { setKeyValue_('Settings', key, value); return { ok: true, key: key, value: value }; }

function settingsObject_() {
  var obj = {};
  rowsToObjects_('Settings').forEach(function (row) { obj[row.Key] = row.Value; });
  return obj;
}

function getKeyValue_(sheetName, key) {
  var sheet = getSheet_(sheetName);
  var headers = sheetHeaders_(sheetName, true);
  var keyCol = headerIndex_(headers, 'Key') + 1;
  var valueCol = headerIndex_(headers, 'Value') + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2 || keyCol < 1 || valueCol < 1) return '';
  var keys = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
  var values = sheet.getRange(2, valueCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) { if (String(keys[i][0]) === String(key)) return values[i][0]; }
  return '';
}

function getKeyValueReadOnly_(sheetName, key) {
  try {
    var sheet = getSpreadsheet_().getSheetByName(sheetName);
    if (!sheet) return '';
    var headers = getHeaderRow_(sheet);
    var keyCol = headerIndex_(headers, 'Key') + 1;
    var valueCol = headerIndex_(headers, 'Value') + 1;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2 || keyCol < 1 || valueCol < 1) return '';
    var keys = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
    var values = sheet.getRange(2, valueCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) { if (String(keys[i][0]) === String(key)) return values[i][0]; }
  } catch (err) {
    return '';
  }
  return '';
}

function setKeyValue_(sheetName, key, value) {
  var sheet = getSheet_(sheetName);
  var headers = sheetHeaders_(sheetName, true);
  var keyCol = headerIndex_(headers, 'Key') + 1;
  var valueCol = headerIndex_(headers, 'Value') + 1;
  if (keyCol < 1 || valueCol < 1) throw new Error(sheetName + ' must contain Key and Value columns');
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var keys = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === String(key)) { sheet.getRange(i + 2, valueCol).setValue(value); return; }
    }
  }
  var row = headers.map(function (h) {
    if (h === 'Key') return key;
    if (h === 'Value') return value;
    return '';
  });
  sheet.getRange(lastRow + 1, 1, 1, headers.length).setValues([row]);
}

function uid_(prefix) {
  return String(prefix || 'ID') + Utilities.getUuid().replace(/-/g, '').slice(0, 16).toUpperCase();
}

function truthy_(value) {
  return value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1';
}

function clampPercent_(value) {
  var n = Number(value || 0);
  if (isNaN(n) || n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function money_(value) {
  var n = Number(value || 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
