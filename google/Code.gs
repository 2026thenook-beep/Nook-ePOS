
/*
 * The Nook ePOS 2.1.0 - Consolidated Google Apps Script backend
 * Deploy as a Web App and paste the Web App URL into js/config.js or Settings in the browser app.
 * This script can be bound to a Google Sheet or can create/use a spreadsheet ID stored in Script Properties.
 */

var NOOK_VERSION = '3.8.6';
var NOOK_DATABASE_VERSION = '1.0.6';
var NOOK_APP_NAME = 'The Nook ePOS';

var SEED_DATA = {
  "meta": {
    "AppName": "The Nook ePOS",
    "FrontendVersion": "3.8.6",
    "BackendVersion": "3.8.6",
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
  "refundItems": [],
  "kitchenQueue": [],
  "deletedItems": []
};

var SHEET_SCHEMAS = {
  Metadata: ['Key', 'Value'],
  Settings: ['Key', 'Value'],
  Categories: ['CategoryID', 'CategoryName', 'Sort', 'Active', 'ButtonColour', 'IsDrinkCategory'],
  MenuItems: ['ItemID', 'CategoryID', 'CategoryName', 'ItemName', 'Description', 'Price', 'Active', 'Sort', 'LoyaltyEligible'],
  Prompts: ['PromptID', 'TriggerItemID', 'PromptTitle', 'PromptType', 'Required', 'Sort', 'Active', 'AllowNotes', 'ShowTitleOnKDS'],
  PromptOptions: ['OptionID', 'PromptID', 'OptionText', 'Action', 'Value', 'Price', 'Sort', 'Active', 'AllowValue'],
  Tickets: ['TicketID', 'TicketNumber', 'CreatedAt', 'OrderType', 'ServerName', 'TableNumber', 'CustomerName', 'Subtotal', 'AddOnTotal', 'DiscountTotal', 'Total', 'PaymentMethod', 'CashTendered', 'ChangeDue', 'Status', 'ClientRequestID', 'LoyaltyTotal'],
  TicketItems: ['TicketItemID', 'TicketID', 'ItemID', 'ItemName', 'CategoryID', 'Quantity', 'BasePrice', 'AddOnTotal', 'LineTotal', 'Note', 'Status', 'LoyaltyRedeemed', 'LoyaltyDiscount'],
  TicketAddOns: ['AddOnID', 'TicketItemID', 'TicketID', 'PromptID', 'PromptTitle', 'OptionID', 'OptionText', 'Quantity', 'UnitPrice', 'Total', 'Action'],
  KitchenQueue: ['KitchenID', 'TicketID', 'TicketNumber', 'CreatedAt', 'OrderType', 'ServerName', 'TableNumber', 'CustomerName', 'Status', 'PayloadJSON'],
  HeldOrders: ['HoldID', 'CreatedAt', 'OrderType', 'ServerName', 'TableNumber', 'CustomerName', 'PayloadJSON', 'Total'],
  Refunds: ['RefundID', 'RefundNumber', 'TicketID', 'TicketNumber', 'CreatedAt', 'Amount', 'Reason', 'StaffName', 'OriginalPaymentMethod'],
  RefundItems: ['RefundItemID', 'RefundID', 'TicketID', 'TicketItemID', 'ItemID', 'ItemName', 'CategoryID', 'Quantity', 'UnitRefundAmount', 'LineRefundTotal'],
  DeletedItems: ['DeletedID', 'DeletedAt', 'EntityType', 'EntityID', 'ParentEntityID', 'Name', 'PayloadJSON', 'DeletedBy', 'Reason'],
  AuditLog: ['EventID', 'CreatedAt', 'Action', 'Entity', 'EntityID', 'PayloadJSON'],
  ReceiptEmails: ['ReceiptEmailID', 'CreatedAt', 'TicketID', 'TicketNumber', 'RecipientEmail', 'StaffName', 'Status', 'ErrorMessage', 'RemainingQuota']
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
  refundItems: 'RefundItems',
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
    if (action === 'reportsSnapshot') return json_(reportsSnapshotResponse_(request));
    if (action === 'ticketHistorySnapshot') return json_(ticketHistorySnapshotResponse_(request));
    if (action === 'diagnosticsRun') return json_(diagnosticsRun_());
    if (action === 'diagnosticsEmailTest') return json_(diagnosticsEmailTest_(request));
    if (action === 'previewDatabaseRepair') return json_({ ok: true, versions: versions_(), schema: previewDatabaseRepair_() });

    if (action === 'setSpreadsheetId') return json_(withMaintenanceLock_(function () { return setSpreadsheetId_(request.SpreadsheetID || request.spreadsheetId); }, 'setSpreadsheetId'));
    if (action === 'clearSpreadsheetId') return json_(withMaintenanceLock_(function () { return clearSpreadsheetId_(); }, 'clearSpreadsheetId'));
    if (action === 'setupDatabase' || action === 'repairDatabase') return json_(withMaintenanceLock_(function () {
      var repair = repairDatabase_({ seedIfEmpty: false });
      return { ok: true, versions: versions_(), schema: repair, data: bootstrapData_() };
    }, action));
    if (action === 'commitTicket') return json_(commitTicket_(request.ticket));
    if (action === 'saveCategory') return json_(withWriteLock_(function () { return saveEntity_('Categories', 'CategoryID', request.category); }, 'saveCategory'));
    if (action === 'saveItem') return json_(withWriteLock_(function () { return saveEntity_('MenuItems', 'ItemID', request.item); }, 'saveItem'));
    if (action === 'saveItemConfiguration') return json_(withWriteLock_(function () { return saveItemConfiguration_(request.configuration); }, 'saveItemConfiguration'));
    if (action === 'savePrompt') return json_(withWriteLock_(function () { return saveEntity_('Prompts', 'PromptID', request.prompt); }, 'savePrompt'));
    if (action === 'savePromptOption') return json_(withWriteLock_(function () { return saveEntity_('PromptOptions', 'OptionID', request.option); }, 'savePromptOption'));
    if (action === 'savePromptOptionsBatch') return json_(withWriteLock_(function () { return savePromptOptionsBatch_(request.promptId, request.options); }, 'savePromptOptionsBatch'));
    if (action === 'copyItemPrompts') return json_(withWriteLock_(function () { return copyItemPrompts_(request.sourceItemId, request.targetItemId); }, 'copyItemPrompts'));
    if (action === 'archiveDeleteEntity') return json_(withMaintenanceLock_(function () { return archiveDeleteEntity_(request.entityType, request.id, request.deletedBy, request.reason); }, 'archiveDeleteEntity'));
    if (action === 'holdOrder') return json_(withWriteLock_(function () { return saveEntity_('HeldOrders', 'HoldID', request.hold); }, 'holdOrder'));
    if (action === 'deleteHeldOrder') return json_(withWriteLock_(function () { return deleteRowById_('HeldOrders', 'HoldID', request.HoldID); }, 'deleteHeldOrder'));
    if (action === 'kitchenUpdate') return json_(withWriteLock_(function () { return kitchenUpdate_(request); }, 'kitchenUpdate'));
    if (action === 'refundTicket') return json_(withWriteLock_(function () { return refundTicket_(request); }, 'refundTicket'));
    if (action === 'saveSetting') return json_(withWriteLock_(function () { return saveSetting_(request.key, request.value); }, 'saveSetting'));
    if (action === 'saveConfirmedUrl') return json_(withWriteLock_(function () { return saveConfirmedUrl_(request); }, 'saveConfirmedUrl'));
    if (action === 'clearReports') return json_(withMaintenanceLock_(function () { return clearReports_(request); }, 'clearReports'));
    if (action === 'emailReceipt') return json_(emailReceipt_(request)); 
    return json_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return json_({ ok: false, error: err && err.stack ? err.stack : String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function bootstrapResponse_() {
  // Startup is deliberately read-only. Database changes are only made after
  // an administrator previews and explicitly applies a repair.
  var preview = previewDatabaseRepair_();
  return { ok: true, versions: versions_(), schema: preview, data: bootstrapData_() };
}

function serverInfoResponse_() {
  return { ok: true, versions: versions_(), schema: previewDatabaseRepair_() };
}

function nonBlockingRepairForRead_() {
  // Retained for compatibility with older callers, but it never writes.
  return previewDatabaseRepair_();
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
  var preview = previewDatabaseRepair_();
  return { ok: true, versions: versions_(), schema: preview, spreadsheetId: ss.getId(), spreadsheetName: ss.getName() };
}

function clearSpreadsheetId_() {
  PropertiesService.getScriptProperties().deleteProperty('SPREADSHEET_ID');
  var ss = getSpreadsheet_();
  var preview = previewDatabaseRepair_();
  return { ok: true, versions: versions_(), schema: preview, spreadsheetId: ss.getId(), spreadsheetName: ss.getName() };
}

function setupSheets_() {
  return repairDatabase_({ seedIfEmpty: false });
}


function previewDatabaseRepair_() {
  var status = schemaStatus_();
  var changes = [];
  Object.keys(status.sheets || {}).forEach(function (name) {
    var sheet = status.sheets[name] || {};
    if (!sheet.exists) {
      changes.push('Create missing sheet: ' + name);
    } else if ((sheet.missingColumns || []).length) {
      changes.push('Add missing column(s) to ' + name + ': ' + sheet.missingColumns.join(', '));
    }
  });

  if (String(getMetaReadOnly_('AppName') || '') !== String(NOOK_APP_NAME)) changes.push('Update metadata: AppName');
  if (String(getMetaReadOnly_('BackendVersion') || '') !== String(NOOK_VERSION)) changes.push('Update metadata: BackendVersion to ' + NOOK_VERSION);
  if (String(getMetaReadOnly_('DatabaseVersion') || '') !== String(NOOK_DATABASE_VERSION)) changes.push('Update metadata: DatabaseVersion to ' + NOOK_DATABASE_VERSION);
  if (!getMetaReadOnly_('NextTicketNumber')) changes.push('Create metadata: NextTicketNumber');

  var requiredSettings = {
    StaffDiscountPercent: '10',
    KitchenDisplayEnabled: 'TRUE',
    KitchenPromptTitlesEnabled: 'TRUE',
    LastConfirmedScriptUrl: '',
    LastConfirmedUrlVersion: '',
    LastConfirmedUrlSavedAt: '',
    LastConfirmedUrlFrontendVersion: '',
    LastConfirmedUrlBackendVersion: '',
    LastConfirmedUrlDatabaseVersion: ''
  };
  Object.keys(requiredSettings).forEach(function (key) {
    if (getSetting_(key) === '') changes.push('Create missing setting: ' + key);
  });

  return {
    ok: changes.length === 0,
    repaired: false,
    preview: true,
    requiresRepair: changes.length > 0,
    changes: changes,
    status: status,
    mode: 'read-only-preview',
    safety: 'Additive only: no existing rows or values will be deleted or overwritten.'
  };
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
  if (getSetting_('KitchenDisplayEnabled') === '') { saveSetting_('KitchenDisplayEnabled', 'TRUE'); changes.push('Settings.KitchenDisplayEnabled defaulted to TRUE'); }
  if (getSetting_('KitchenPromptTitlesEnabled') === '') { saveSetting_('KitchenPromptTitlesEnabled', 'TRUE'); changes.push('Settings.KitchenPromptTitlesEnabled defaulted to TRUE'); }
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
  ['Tickets','TicketItems','TicketAddOns','Refunds','RefundItems','KitchenQueue'].forEach(function (sheetName) {
    var sheet = getSheet_(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  });
  setMeta_('NextTicketNumber', '0');
  appendAudit_('CLEAR_ALL_REPORTS', 'Reports', 'ALL', { resetTicketCounterTo: 0, clearedAt: new Date().toISOString() });
  return { ok: true, nextTicketNumber: 0 };
}

function localDateString_(value) {
  if (!value) return '';
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value).slice(0, 10);
  return Utilities.formatDate(date, 'Europe/London', 'yyyy-MM-dd');
}

function transactionSnapshotForRange_(fromDate, toDate) {
  fromDate = String(fromDate || '').slice(0, 10);
  toDate = String(toDate || fromDate || '').slice(0, 10);
  var tickets = rowsToObjects_('Tickets').filter(function (row) {
    var day = localDateString_(row.CreatedAt);
    return day && (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
  });
  var ticketIds = {};
  tickets.forEach(function (row) { ticketIds[String(row.TicketID)] = true; });
  var refunds = rowsToObjects_('Refunds').filter(function (row) {
    var day = localDateString_(row.CreatedAt);
    return day && (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
  });
  var refundIds = {};
  refunds.forEach(function (row) { refundIds[String(row.RefundID)] = true; });
  return {
    tickets: tickets,
    ticketItems: rowsToObjects_('TicketItems').filter(function (row) { return ticketIds[String(row.TicketID)]; }),
    ticketAddOns: rowsToObjects_('TicketAddOns').filter(function (row) { return ticketIds[String(row.TicketID)]; }),
    refunds: refunds,
    refundItems: rowsToObjects_('RefundItems').filter(function (row) { return refundIds[String(row.RefundID)]; })
  };
}

function reportsSnapshotResponse_(request) {
  var today = Utilities.formatDate(new Date(), 'Europe/London', 'yyyy-MM-dd');
  var fromDate = String(request.fromDate || today).slice(0, 10);
  var toDate = String(request.toDate || fromDate).slice(0, 10);
  return { ok: true, versions: versions_(), fromDate: fromDate, toDate: toDate, data: transactionSnapshotForRange_(fromDate, toDate) };
}

function ticketHistorySnapshotResponse_(request) {
  var today = Utilities.formatDate(new Date(), 'Europe/London', 'yyyy-MM-dd');
  var date = String(request.date || today).slice(0, 10);
  return { ok: true, versions: versions_(), date: date, data: transactionSnapshotForRange_(date, date) };
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
  if (['Sort', 'Price', 'TicketNumber', 'Subtotal', 'AddOnTotal', 'DiscountTotal', 'Total', 'LoyaltyTotal', 'CashTendered', 'ChangeDue', 'Quantity', 'BasePrice', 'LineTotal', 'LoyaltyDiscount', 'UnitPrice', 'Amount', 'UnitRefundAmount', 'LineRefundTotal'].indexOf(field) >= 0) {
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


function editableRowValue_(value) {
  if (value instanceof Date) return value.toISOString();
  if (value == null) return '';
  return value;
}

function readSheetTable_(sheetName) {
  var sheet = getSheet_(sheetName);
  var headers = sheetHeaders_(sheetName, true);
  var lastRow = sheet.getLastRow();
  var values = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues() : [];
  var objects = values.filter(function (row) {
    return row.some(function (cell) { return cell !== '' && cell != null; });
  }).map(function (row) {
    var obj = {};
    headers.forEach(function (header, index) {
      if (header) obj[header] = coerce_(header, row[index]);
    });
    return obj;
  });
  return { sheet: sheet, headers: headers, values: values, objects: objects };
}

function mergeStoredObject_(stored, incoming) {
  return Object.assign({}, stored || {}, incoming || {});
}

function objectsToRows_(headers, objects) {
  return (objects || []).map(function (obj) {
    return headers.map(function (header) {
      return editableRowValue_(Object.prototype.hasOwnProperty.call(obj || {}, header) ? obj[header] : '');
    });
  });
}

function comparableRows_(rows) {
  return JSON.stringify((rows || []).map(function (row) {
    return row.map(function (value) {
      if (value instanceof Date) return value.toISOString();
      if (value === true || value === false) return value;
      if (value == null) return '';
      return String(value);
    });
  }));
}

function writeSheetObjectsIfChanged_(table, objects) {
  var nextRows = objectsToRows_(table.headers, objects);
  if (comparableRows_(table.values) === comparableRows_(nextRows)) return false;
  var previousCount = table.values.length;
  if (previousCount > 0) table.sheet.getRange(2, 1, previousCount, table.headers.length).clearContent();
  if (nextRows.length > 0) table.sheet.getRange(2, 1, nextRows.length, table.headers.length).setValues(nextRows);
  return true;
}

function saveItemConfiguration_(configuration) {
  configuration = configuration || {};
  var item = configuration.item;
  var prompts = Array.isArray(configuration.prompts) ? configuration.prompts : [];
  var options = Array.isArray(configuration.options) ? configuration.options : [];
  if (!item || !item.ItemID) throw new Error('Item configuration is missing its ItemID.');
  if (!item.ItemName) throw new Error('Item configuration is missing its item name.');

  var itemId = String(item.ItemID);
  var promptIds = {};
  prompts.forEach(function (prompt) {
    if (!prompt || !prompt.PromptID) throw new Error('A prompt is missing its PromptID.');
    if (String(prompt.TriggerItemID) !== itemId) throw new Error('Prompt belongs to the wrong menu item: ' + prompt.PromptID);
    promptIds[String(prompt.PromptID)] = true;
  });
  options.forEach(function (option) {
    if (!option || !option.OptionID) throw new Error('A prompt option is missing its OptionID.');
    if (!promptIds[String(option.PromptID)]) throw new Error('Prompt option belongs to a prompt outside this item: ' + option.OptionID);
  });

  // Each affected sheet is read once. All comparisons and merges happen in memory.
  var itemTable = readSheetTable_('MenuItems');
  var promptTable = readSheetTable_('Prompts');
  var optionTable = readSheetTable_('PromptOptions');

  var existingItemById = {};
  itemTable.objects.forEach(function (row) { existingItemById[String(row.ItemID)] = row; });
  var savedItem = mergeStoredObject_(existingItemById[itemId], item);
  var nextItems = itemTable.objects.filter(function (row) { return String(row.ItemID) !== itemId; });
  nextItems.push(savedItem);

  var existingPromptById = {};
  var oldPromptIds = {};
  promptTable.objects.forEach(function (row) {
    existingPromptById[String(row.PromptID)] = row;
    if (String(row.TriggerItemID) === itemId) oldPromptIds[String(row.PromptID)] = true;
  });
  var savedPrompts = prompts.map(function (prompt, index) {
    var merged = mergeStoredObject_(existingPromptById[String(prompt.PromptID)], prompt);
    merged.TriggerItemID = item.ItemID;
    merged.Sort = Number(prompt.Sort || ((index + 1) * 10));
    return merged;
  });
  var nextPrompts = promptTable.objects.filter(function (row) { return String(row.TriggerItemID) !== itemId; }).concat(savedPrompts);

  var existingOptionById = {};
  optionTable.objects.forEach(function (row) { existingOptionById[String(row.OptionID)] = row; });
  var optionPositionByPrompt = {};
  var savedOptions = options.map(function (option) {
    var promptId = String(option.PromptID);
    optionPositionByPrompt[promptId] = (optionPositionByPrompt[promptId] || 0) + 1;
    var merged = mergeStoredObject_(existingOptionById[String(option.OptionID)], option);
    merged.Sort = optionPositionByPrompt[promptId] * 10;
    return merged;
  });
  var affectedPromptIds = Object.assign({}, oldPromptIds, promptIds);
  var nextOptions = optionTable.objects.filter(function (row) { return !affectedPromptIds[String(row.PromptID)]; }).concat(savedOptions);

  var changedSheets = [];
  if (writeSheetObjectsIfChanged_(itemTable, nextItems)) changedSheets.push('MenuItems');
  if (writeSheetObjectsIfChanged_(promptTable, nextPrompts)) changedSheets.push('Prompts');
  if (writeSheetObjectsIfChanged_(optionTable, nextOptions)) changedSheets.push('PromptOptions');

  appendAudit_('SAVE_ITEM_CONFIGURATION_DIFF', 'MenuItems', item.ItemID, {
    changedSheets: changedSheets,
    promptCount: savedPrompts.length,
    optionCount: savedOptions.length
  });
  return {
    ok: true,
    changed: changedSheets.length > 0,
    changedSheets: changedSheets,
    configuration: { item: savedItem, prompts: savedPrompts, options: savedOptions }
  };
}

function savePromptOptionsBatch_(promptId, options) {
  if (!promptId) throw new Error('Missing PromptID for prompt option batch save.');
  if (!Array.isArray(options) || !options.length) throw new Error('No prompt options were supplied.');

  var existingById = {};
  rowsToObjects_('PromptOptions').filter(function (option) {
    return String(option.PromptID) === String(promptId);
  }).forEach(function (option) {
    existingById[String(option.OptionID)] = option;
  });

  var seen = {};
  var saved = options.map(function (option, index) {
    if (!option || !option.OptionID) throw new Error('A prompt option is missing its OptionID.');
    if (String(option.PromptID) !== String(promptId)) throw new Error('Prompt option belongs to the wrong prompt: ' + option.OptionID);
    if (seen[String(option.OptionID)]) throw new Error('Duplicate prompt option in final order: ' + option.OptionID);
    seen[String(option.OptionID)] = true;
    var merged = Object.assign({}, existingById[String(option.OptionID)] || {}, option);
    merged.PromptID = promptId;
    // The server owns the stored sequence. Only the final array position is used.
    merged.Sort = (index + 1) * 10;
    upsertObject_('PromptOptions', 'OptionID', merged);
    return merged;
  });

  appendAudit_('SAVE_PROMPT_OPTIONS_BATCH', 'Prompts', promptId, {
    optionCount: saved.length,
    finalOrder: saved.map(function (option) { return option.OptionID; })
  });
  return { ok: true, promptId: promptId, saved: saved, finalOrder: saved.map(function (option) { return option.OptionID; }) };
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

    var kitchen = null;
    var kitchenEnabled = String(getSetting_('KitchenDisplayEnabled') || 'TRUE').toUpperCase() !== 'FALSE';
    if (kitchenEnabled) {
      var kitchenPayload = kitchenPayload_(ticket, ticketItems, ticketAddOns);
      kitchen = {
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
    }
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
  var rows = rowsToObjects_('KitchenQueue');
  var existing = rows.filter(function (row) { return String(row.KitchenID) === String(request.KitchenID); })[0];
  if (!existing) throw new Error('Cannot find ' + request.KitchenID + ' in KitchenQueue');

  var payload = {};
  try { payload = JSON.parse(String(existing.PayloadJSON || '{}')); }
  catch (err) { payload = {}; }
  payload.Sections = payload.Sections || {};

  var items = Array.isArray(payload.Items) ? payload.Items : [];
  var hasFood = false;
  var hasDrinks = false;
  items.forEach(function (item) {
    var category = rowsToObjects_('Categories').filter(function (c) { return String(c.CategoryID) === String(item.CategoryID); })[0];
    if (category && truthy_(category.IsDrinkCategory)) hasDrinks = true;
    else hasFood = true;
  });

  if (request.CompleteAll === true || request.CompleteAll === 'true') {
    if (hasFood) payload.Sections.FoodStatus = 'COMPLETE';
    if (hasDrinks) payload.Sections.DrinksStatus = 'COMPLETE';
  } else {
    var sectionName = String(request.SectionName || '').toLowerCase();
    var sectionStatus = String(request.SectionStatus || '').toUpperCase();
    if (sectionName !== 'food' && sectionName !== 'drinks') throw new Error('Invalid kitchen section');
    if (sectionStatus !== 'OPEN' && sectionStatus !== 'COMPLETE') throw new Error('Invalid kitchen section status');
    if (sectionName === 'food') payload.Sections.FoodStatus = sectionStatus;
    if (sectionName === 'drinks') payload.Sections.DrinksStatus = sectionStatus;
  }

  var foodDone = !hasFood || String(payload.Sections.FoodStatus || 'OPEN') === 'COMPLETE';
  var drinksDone = !hasDrinks || String(payload.Sections.DrinksStatus || 'OPEN') === 'COMPLETE';
  var overall = foodDone && drinksDone ? 'COMPLETE' : 'OPEN';
  payload.Sections.CompletedAt = overall === 'COMPLETE' ? new Date().toISOString() : '';

  return updateById_('KitchenQueue', 'KitchenID', request.KitchenID, {
    Status: overall,
    PayloadJSON: JSON.stringify(payload)
  });
}

function refundTicket_(request) {
  request = request || {};
  var ticketId = String(request.ticketId || '').trim();
  var requestedItems = request.items || [];
  var reason = String(request.reason || '').trim();
  var staffName = String(request.staffName || '').trim();
  if (!ticketId) throw new Error('Missing ticket ID');
  if (!requestedItems.length) throw new Error('Select at least one item to refund');
  if (!reason) throw new Error('A refund reason is required');
  if (!staffName) throw new Error('The staff name is required');

  var ticket = rowsToObjects_('Tickets').filter(function (row) { return String(row.TicketID) === ticketId; })[0];
  if (!ticket) throw new Error('The original ticket was not found');
  var ticketItems = rowsToObjects_('TicketItems').filter(function (row) { return String(row.TicketID) === ticketId; });
  var previousRefundItems = rowsToObjects_('RefundItems').filter(function (row) { return String(row.TicketID) === ticketId; });
  var existingRefunds = rowsToObjects_('Refunds').filter(function (row) { return String(row.TicketID) === ticketId; });
  var refundId = uid_('R');
  var refundNumber = String(ticket.TicketNumber) + '-R' + (existingRefunds.length + 1);
  var refundItems = [];
  var amount = 0;

  requestedItems.forEach(function (selection) {
    var ticketItemId = String(selection.TicketItemID || '').trim();
    var quantity = Number(selection.Quantity || 0);
    if (!ticketItemId || !isFinite(quantity) || quantity <= 0 || Math.floor(quantity) !== quantity) throw new Error('Refund quantities must be whole numbers greater than zero');
    var sold = ticketItems.filter(function (line) { return String(line.TicketItemID) === ticketItemId; })[0];
    if (!sold) throw new Error('A selected item does not belong to this ticket');
    var alreadyRefunded = previousRefundItems.filter(function (line) { return String(line.TicketItemID) === ticketItemId; }).reduce(function (sum, line) { return sum + Number(line.Quantity || 0); }, 0);
    var soldQuantity = Number(sold.Quantity || 0);
    if (quantity > soldQuantity - alreadyRefunded) throw new Error(sold.ItemName + ' cannot be refunded above the remaining sold quantity');
    var netLineValue = Number(sold.LineTotal || 0) - Number(sold.LoyaltyDiscount || 0);
    var unitRefund = soldQuantity > 0 ? Math.round((netLineValue / soldQuantity) * 100) / 100 : 0;
    var lineTotal = Math.round(unitRefund * quantity * 100) / 100;
    amount += lineTotal;
    refundItems.push({ RefundItemID: uid_('RI'), RefundID: refundId, TicketID: ticketId, TicketItemID: ticketItemId, ItemID: sold.ItemID, ItemName: sold.ItemName, CategoryID: sold.CategoryID, Quantity: quantity, UnitRefundAmount: unitRefund, LineRefundTotal: lineTotal });
  });

  amount = Math.round(amount * 100) / 100;
  if (amount <= 0) throw new Error('The calculated refund amount is zero');
  var refund = { RefundID: refundId, RefundNumber: refundNumber, TicketID: ticketId, TicketNumber: ticket.TicketNumber, CreatedAt: new Date().toISOString(), Amount: amount, Reason: reason, StaffName: staffName, OriginalPaymentMethod: ticket.PaymentMethod || '' };
  appendObjects_('Refunds', [refund]);
  appendObjects_('RefundItems', refundItems);
  appendAudit_('ITEM_REFUND', 'Refunds', refundId, { refund: refund, refundItems: refundItems });
  return { ok: true, refund: refund, refundItems: refundItems };
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

function deleteKeyValue_(sheetName, key) {
  var sheet = getSheet_(sheetName);
  var headers = sheetHeaders_(sheetName, true);
  var keyCol = headerIndex_(headers, 'Key') + 1;
  if (keyCol < 1) throw new Error(sheetName + ' must contain a Key column');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var keys = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(key)) { sheet.deleteRow(i + 2); return true; }
  }
  return false;
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


function diagnosticsRun_() {
  var results = {};
  results.network = { status: 'PASS', message: 'Apps Script web app responded successfully.', detail: new Date().toISOString() };
  try {
    var ss = getSpreadsheet_();
    var sheetNames = ss.getSheets().map(function (sheet) { return sheet.getName(); });
    results.databaseRead = { status: 'PASS', message: 'Live spreadsheet can be read.', detail: ss.getName() + ' • ' + sheetNames.length + ' sheets' };
  } catch (err) {
    results.databaseRead = { status: 'FAIL', message: 'Live spreadsheet could not be read.', detail: errorMessage_(err) };
  }
  try {
    var testKey = '__DiagnosticsWriteTest';
    var previous = getKeyValue_('Settings', testKey);
    var token = Utilities.getUuid();
    setKeyValue_('Settings', testKey, token);
    var confirmed = String(getKeyValue_('Settings', testKey)) === token;
    if (previous === '' || previous == null) deleteKeyValue_('Settings', testKey); else setKeyValue_('Settings', testKey, previous);
    results.databaseWrite = confirmed
      ? { status: 'PASS', message: 'Live spreadsheet write and read-back succeeded.' }
      : { status: 'FAIL', message: 'The diagnostic value could not be read back correctly.' };
  } catch (err2) {
    results.databaseWrite = { status: 'FAIL', message: 'Live spreadsheet write test failed.', detail: errorMessage_(err2) };
  }
  try {
    var queue = rowsToObjects_('KitchenQueue');
    var open = queue.filter(function (row) { return String(row.Status || '').toUpperCase() !== 'COMPLETED'; }).length;
    results.kitchen = { status: 'PASS', message: 'Kitchen queue data is readable.', detail: open + ' open ticket(s)' };
  } catch (err3) {
    results.kitchen = { status: 'FAIL', message: 'Kitchen queue data could not be read.', detail: errorMessage_(err3) };
  }
  try {
    var versions = versions_();
    var match = String(versions.BackendVersion) === String(NOOK_VERSION);
    results.versions = { status: match ? 'PASS' : 'FAIL', message: match ? 'Backend and deployed code versions match.' : 'Version mismatch detected.', detail: 'Backend ' + versions.BackendVersion + ' • Database ' + versions.DatabaseVersion };
  } catch (err4) {
    results.versions = { status: 'FAIL', message: 'Version information could not be checked.', detail: errorMessage_(err4) };
  }
  try {
    var quota = MailApp.getRemainingDailyQuota();
    results.email = { status: quota > 0 ? 'READY' : 'WARN', message: quota > 0 ? 'Email service is authorised and has available quota.' : 'Email is authorised but the daily quota is exhausted.', detail: 'Remaining daily quota: ' + quota };
  } catch (err5) {
    results.email = { status: 'FAIL', message: 'Email service is not authorised or unavailable.', detail: errorMessage_(err5) };
  }
  return { ok: true, results: results, versions: versionsSafe_() };
}

function diagnosticsEmailTest_(request) {
  var recipient = String(request.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('A valid test email address is required.');
  var quota = MailApp.getRemainingDailyQuota();
  if (quota < 1) throw new Error('The Google Apps Script daily email quota has been used.');
  MailApp.sendEmail({
    to: recipient,
    subject: 'The Nook ePOS diagnostic email',
    body: 'The Nook ePOS email service is authorised and working.\n\nTest time: ' + new Date().toISOString(),
    name: 'The Nook'
  });
  return { ok: true, recipient: recipient, remainingQuota: MailApp.getRemainingDailyQuota() };
}

/***************************************************************
 * THE NOOK EPOS — MANUAL MAINTENANCE FUNCTIONS
 *
 * These functions deliberately have no trailing underscore so they
 * remain visible in the Apps Script function selector. They are safe
 * administrative entry points for deployment, authorisation and checks.
 ***************************************************************/

/**
 * Forces Google to request MailApp authorisation when required and
 * returns useful confirmation without sending an email.
 */
function authoriseEmailService() {
  var account = '';
  try { account = Session.getEffectiveUser().getEmail() || ''; } catch (err) { account = ''; }
  var result = {
    authorised: true,
    account: account,
    remainingQuota: MailApp.getRemainingDailyQuota(),
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(result));
  return result;
}

/** Sends a real diagnostic email to the Apps Script owner's account. */
function sendTestEmailToScriptOwner() {
  var recipient = String(Session.getEffectiveUser().getEmail() || '').trim();
  if (!recipient) throw new Error('Google could not identify the script owner email. Use the POS Diagnostics test-email field instead.');
  return diagnosticsEmailTest_({ email: recipient });
}

/** Runs the same server-side checks shown in Settings > Diagnostics. */
function runSystemDiagnostics() {
  var result = diagnosticsRun_();
  console.log(JSON.stringify(result));
  return result;
}

/** Previews the exact additive changes a repair would make, without writing anything. */
function previewSpreadsheetRepair() {
  var result = previewDatabaseRepair_();
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Repairs the live spreadsheet schema without adding demonstration data. */
function repairSpreadsheet() {
  var result = withMaintenanceLock_(function () {
    return repairDatabase_({ seedIfEmpty: false });
  }, 'manualRepairSpreadsheet');
  console.log(JSON.stringify(result));
  return result;
}

/** Sets up or repairs an empty/live database, including required seed defaults. */
function setupOrRepairDatabase() {
  var result = withMaintenanceLock_(function () {
    return repairDatabase_({ seedIfEmpty: true });
  }, 'manualSetupOrRepairDatabase');
  console.log(JSON.stringify(result));
  return result;
}

/** Confirms which spreadsheet is linked and whether its schema is valid. */
function verifyDatabaseConnection() {
  var ss = getSpreadsheet_();
  var result = {
    ok: true,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    schema: schemaStatus_(),
    versions: versions_(),
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(result));
  return result;
}

function emailReceipt_(request) {
  var ticketId = String(request.ticketId || request.TicketID || '').trim();
  var recipient = String(request.email || '').trim();
  var optionalMessage = String(request.message || '').trim();
  if (!ticketId) throw new Error('Ticket ID is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('A valid customer email address is required.');

  var tickets = rowsToObjects_('Tickets');
  var ticket = tickets.filter(function (row) { return String(row.TicketID) === ticketId; })[0];
  if (!ticket) throw new Error('Ticket was not found in Google Sheets.');
  var items = rowsToObjects_('TicketItems').filter(function (row) { return String(row.TicketID) === ticketId; });
  enrichTicketItemCategories_(items);
  var itemIds = {};
  items.forEach(function (row) { itemIds[String(row.TicketItemID)] = true; });
  var addOns = rowsToObjects_('TicketAddOns').filter(function (row) { return String(row.TicketID) === ticketId || itemIds[String(row.TicketItemID)]; });
  var quota = MailApp.getRemainingDailyQuota();
  if (quota < 1) throw new Error('The Google Apps Script daily email quota has been used.');

  var subject = 'The Nook receipt #' + ticket.TicketNumber;
  var htmlBody = buildReceiptHtml_(ticket, items, addOns, optionalMessage);
  var plainBody = buildReceiptText_(ticket, items, addOns, optionalMessage);
  var status = 'SENT';
  var errorMessage = '';
  try {
    MailApp.sendEmail({ to: recipient, subject: subject, body: plainBody, htmlBody: htmlBody, name: 'The Nook' });
  } catch (err) {
    status = 'FAILED';
    errorMessage = String(err && err.message ? err.message : err);
  }
  var remaining = MailApp.getRemainingDailyQuota();
  withWriteLock_(function () {
    appendObjects_('ReceiptEmails', [{
      ReceiptEmailID: Utilities.getUuid(), CreatedAt: new Date().toISOString(), TicketID: ticket.TicketID,
      TicketNumber: ticket.TicketNumber, RecipientEmail: recipient, StaffName: ticket.ServerName || '',
      Status: status, ErrorMessage: errorMessage, RemainingQuota: remaining
    }]);
    return true;
  }, 'emailReceiptAudit');
  if (status !== 'SENT') throw new Error(errorMessage || 'Receipt email failed.');
  return { ok: true, ticketNumber: ticket.TicketNumber, recipient: recipient, remainingQuota: remaining };
}


function enrichTicketItemCategories_(items) {
  var categories = {};
  rowsToObjects_('Categories').forEach(function (category) {
    categories[String(category.CategoryID || '')] = String(category.CategoryName || '');
  });
  var menuItems = {};
  rowsToObjects_('MenuItems').forEach(function (menuItem) {
    menuItems[String(menuItem.ItemID || '')] = menuItem;
  });
  (items || []).forEach(function (item) {
    if (String(item.CategoryName || '').trim()) return;
    var menuItem = menuItems[String(item.ItemID || '')] || {};
    var categoryId = String(item.CategoryID || menuItem.CategoryID || '');
    item.CategoryID = categoryId;
    item.CategoryName = categories[categoryId] || String(menuItem.CategoryName || '') || 'Uncategorised';
  });
  return items;
}

function receiptEscape_(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function receiptMoney_(value) { return '£' + Number(value || 0).toFixed(2); }

function receiptVariableQuantityMap_() {
  var map = {};
  rowsToObjects_('PromptOptions').forEach(function (option) {
    map[String(option.OptionID || '')] = option.AllowValue === true || String(option.AllowValue).toLowerCase() === 'true' || option.AllowValue === 1 || option.AllowValue === '1';
  });
  return map;
}

function receiptAddOnText_(addOn, variableMap) {
  var text = String(addOn.OptionText || 'Additional item');
  if (variableMap[String(addOn.OptionID || '')]) text += ' ×' + Math.max(1, Number(addOn.Quantity || 1));
  return text;
}

function buildReceiptHtml_(ticket, items, addOns, optionalMessage) {
  var addOnMap = {};
  var variableMap = receiptVariableQuantityMap_();
  addOns.forEach(function (a) { (addOnMap[a.TicketItemID] = addOnMap[a.TicketItemID] || []).push(a); });
  var rows = items.map(function (item) {
    var extras = (addOnMap[item.TicketItemID] || []).map(function (a) { return '<div style="font-size:13px;color:#555;padding-left:14px">+ ' + receiptEscape_(receiptAddOnText_(a, variableMap)) + (Number(a.Total || 0) ? ' ' + receiptMoney_(a.Total) : '') + '</div>'; }).join('');
    return '<div style="border-bottom:1px solid #eee;padding:10px 0"><div style="display:flex;justify-content:space-between;gap:12px"><strong>' + receiptEscape_(item.Quantity) + ' × ' + receiptEscape_(item.ItemName) + '</strong><strong>' + receiptMoney_(item.LineTotal) + '</strong></div><div style="font-size:12px;color:#777">' + receiptEscape_(item.CategoryName || item.CategoryID || 'Uncategorised') + '</div>' + extras + (item.Note ? '<div style="font-size:13px"><em>Note: ' + receiptEscape_(item.Note) + '</em></div>' : '') + '</div>';
  }).join('');
  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#222"><h1 style="margin-bottom:0">The Nook</h1><div style="color:#666">Coffee • Food • Community</div><hr>' + (optionalMessage ? '<p>' + receiptEscape_(optionalMessage).replace(/\n/g, '<br>') + '</p>' : '') + '<h2>Receipt #' + receiptEscape_(ticket.TicketNumber) + '</h2><p>' + receiptEscape_(ticket.CreatedAt) + '<br>' + receiptEscape_(ticket.OrderType || '') + (ticket.TableNumber ? '<br>Table: ' + receiptEscape_(ticket.TableNumber) : '') + (ticket.CustomerName ? '<br>Customer: ' + receiptEscape_(ticket.CustomerName) : '') + '</p>' + rows + '<div style="padding-top:12px"><div>Items: ' + receiptMoney_(ticket.Subtotal) + '</div><div>Additional items: ' + receiptMoney_(ticket.AddOnTotal) + '</div>' + (Number(ticket.LoyaltyTotal || 0) ? '<div>Loyalty: -' + receiptMoney_(ticket.LoyaltyTotal) + '</div>' : '') + (Number(ticket.DiscountTotal || 0) ? '<div>Discount: -' + receiptMoney_(ticket.DiscountTotal) + '</div>' : '') + '<h2>Total: ' + receiptMoney_(ticket.Total) + '</h2><div>Paid by ' + receiptEscape_(ticket.PaymentMethod || '') + '</div></div><p style="margin-top:24px;color:#666">Thank you for visiting The Nook.</p></div>';
}

function buildReceiptText_(ticket, items, addOns, optionalMessage) {
  var lines = ['THE NOOK', 'Receipt #' + ticket.TicketNumber, String(ticket.CreatedAt || ''), ''];
  var addOnMap = {};
  var variableMap = receiptVariableQuantityMap_();
  (addOns || []).forEach(function (a) { (addOnMap[a.TicketItemID] = addOnMap[a.TicketItemID] || []).push(a); });
  if (optionalMessage) lines.push(optionalMessage, '');
  items.forEach(function (item) {
    lines.push(String(item.Quantity || 1) + ' x ' + item.ItemName + '  ' + receiptMoney_(item.LineTotal));
    lines.push('  Category: ' + (item.CategoryName || 'Uncategorised'));
    (addOnMap[item.TicketItemID] || []).forEach(function (a) {
      lines.push('  + ' + receiptAddOnText_(a, variableMap) + (Number(a.Total || 0) ? ' ' + receiptMoney_(a.Total) : ''));
    });
    if (item.Note) lines.push('  Note: ' + item.Note);
  });
  lines.push('', 'Total: ' + receiptMoney_(ticket.Total), 'Paid by ' + (ticket.PaymentMethod || ''), '', 'Thank you for visiting The Nook.');
  return lines.join('\n');
}
