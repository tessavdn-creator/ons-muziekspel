/* TRACKBACK COMPACT — 24 light, one-colour coins for Bambu A1 mini */
$fn = 48;
part = "sheet"; // "coin" or "sheet"
// Aantal munten op de plaat. Standaard 24 (vier rijen van zes); geef rows en
// columns mee voor een kleinere oplage, bijvoorbeeld 4 x 4 voor zestien.
rows = 4;
columns = 6;
coin_diameter = 20;
coin_thickness = 2.0;
relief_height = 0.4;
coin_gap = 3;

module coin_body() {
    rotate_extrude()
        polygon([[0,0],[9.6,0],[10,0.4],[10,1.6],[9.6,coin_thickness],[0,coin_thickness]]);
}

module coin() {
    union() {
        coin_body();
        translate([0, 0, coin_thickness])
            linear_extrude(height = relief_height)
                text("+1", size = 7, font = "Arial:style=Bold", halign = "center", valign = "center");
    }
}

module sheet() {
    for (row = [0 : rows - 1]) for (column = [0 : columns - 1])
        translate([coin_diameter / 2 + column * (coin_diameter + coin_gap), coin_diameter / 2 + row * (coin_diameter + coin_gap), 0]) coin();
}

if (part == "coin") coin(); else sheet();
