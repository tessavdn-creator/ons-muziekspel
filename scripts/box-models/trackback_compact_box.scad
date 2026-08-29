/*
  TRACKBACK COMPACT — cards + 24 coins in one box
  Bambu Lab A1 mini safe: largest Iris lid is about 168 x 72 mm.

  Export with -D 'edition="iris"', 'edition="nikki"' or 'edition="lodewijk"'
  and -D 'part="box"', 'part="lid"' or 'part="fit_test"'.

  Lodewijk's cards are 50 mm instead of 60, so pass -D card_size=50 with that
  edition. Every wall thickness is a parameter as well, which is how the frugal
  variant is built: less plastic without redrawing the model.
*/

$fn = 72;

part = "box";
edition = "iris";

card_size = 60;
card_clearance = 1.5;
deck_depth = 32;          // 100 printed cards, up to about 0.28 mm each + reserve
wall = 2.2;
floor_thickness = 2.2;
divider = 1.6;
divider_height = 50;
outer_radius = 6;
inner_radius = 2.2;

// Aantal munten dat in de twee kuiltjes past. Dit getal staat ook op het deksel,
// dus het mag niet los van de werkelijke plankhoogte kunnen gaan lopen.
coins_per_well = 12;
// Ingegraveerde vakjeslabels op de voorkant van de bak. Op een klein doosje zijn
// die zo fijn dat ze eerder als vlekjes lezen dan als tekst; met false blijft de
// voorkant glad. De tekst op het deksel staat hier los van.
box_labels = true;
coin_diameter = 20;
coin_clearance = 1.2;
coin_bay_depth = 24;
coin_thickness = 2.0;
// De plank is precies zo hoog als de munten die erin gaan, plus de bodem. Zo kan
// het aantal op het deksel niet gaan afwijken van wat er werkelijk in past.
coin_shelf_height = coins_per_well * coin_thickness + floor_thickness;

lid_clearance = 0.35;
lid_wall = 2;
lid_top = 2.2;
lid_skirt = 9;

deck_count = edition == "iris" ? 4 : 3;
edition_name = edition == "iris" ? "IRIS" : edition == "lodewijk" ? "LODEWIJK" : "NIKKI";
coin_total = coins_per_well * 2;
edition_subtitle = edition == "iris"
    ? str("4 EDITIES + ", coin_total, " MUNTEN")
    : str("300 KAARTEN + ", coin_total, " MUNTEN");

iris_top = ["HIDDEN", "THE CROOKED", "AFTER", "CROWD"];
iris_bottom = ["CORNERS", "TIMELINE", "DARK", "PLEASERS"];
nikki_top = ["KAART 001", "KAART 101", "KAART 201"];
nikki_bottom = ["TOT 100", "TOT 200", "TOT 300"];
// De kaarten komen geschud uit de printer, niet op decennium gesorteerd, dus de
// vakjes worden op kaartnummer gelabeld net als bij Nikki.
lodewijk_top = ["KAART 001", "KAART 101", "KAART 201"];
lodewijk_bottom = ["TOT 100", "TOT 200", "TOT 300"];

inner_width = card_size + 2 * card_clearance;
inner_height = card_size + 3;
card_zone_length = deck_count * deck_depth + (deck_count - 1) * divider;
coin_divider_x = wall + card_zone_length;
inner_length = card_zone_length + divider + coin_bay_depth;
box_length = inner_length + 2 * wall;
box_width = inner_width + 2 * wall;
box_height = inner_height + floor_thickness;

module rounded_prism(size, radius) {
    translate([radius, radius, 0])
        linear_extrude(height = size[2])
            offset(r = radius)
                square([size[0] - 2 * radius, size[1] - 2 * radius]);
}

module label_cut(top_line, bottom_line, x) {
    translate([x, 0.55, 15.5])
        rotate([90, 0, 0])
            linear_extrude(height = 0.7)
                text(top_line, size = 3.05, font = "Arial:style=Bold", halign = "center", valign = "center");
    translate([x, 0.55, 10.8])
        rotate([90, 0, 0])
            linear_extrude(height = 0.7)
                text(bottom_line, size = 3.05, font = "Arial:style=Bold", halign = "center", valign = "center");
}

module compact_box() {
    difference() {
        union() {
            difference() {
                rounded_prism([box_length, box_width, box_height], outer_radius);
                translate([wall, wall, floor_thickness])
                    rounded_prism([inner_length, inner_width, inner_height + 1], inner_radius);
            }

            // Card dividers: four named Iris sets or three numbered Nikki stacks.
            for (i = [1 : deck_count - 1]) {
                x = wall + i * deck_depth + (i - 1) * divider;
                translate([x, wall, floor_thickness])
                    cube([divider, inner_width, divider_height]);
            }

            // Full separator plus raised coin tray. The two wells hold 12 coins each.
            translate([coin_divider_x, wall, floor_thickness])
                cube([divider, inner_width, divider_height]);
            translate([coin_divider_x + divider, wall, floor_thickness])
                cube([coin_bay_depth, inner_width, coin_shelf_height - floor_thickness]);
        }

        // Finger scoops on both long walls for every 100-card stack.
        for (i = [0 : deck_count - 1]) {
            x = wall + deck_depth / 2 + i * (deck_depth + divider);
            translate([x, -1, box_height])
                rotate([-90, 0, 0]) cylinder(h = box_width + 2, r = 10);
        }

        // Two coin wells; deliberately loose enough for an A1 mini print.
        coin_x = coin_divider_x + divider + coin_bay_depth / 2;
        // Op een kwart en driekwart van de binnenbreedte, niet op een vaste 17 mm.
        // Met die vaste maat stonden de kuilen bij een smallere doos maar 19 mm uit
        // elkaar terwijl ze 21,2 mm breed zijn: dan lopen ze in elkaar over en is de
        // scheiding tussen de twee muntvakjes weg.
        for (coin_y = [wall + inner_width / 4, wall + inner_width * 3 / 4]) {
            translate([coin_x, coin_y, floor_thickness])
                cylinder(h = coin_shelf_height - floor_thickness + 1, d = coin_diameter + coin_clearance);
            translate([coin_x, coin_y, coin_shelf_height])
                rotate([0, 90, 0]) cylinder(h = coin_bay_depth + 2, r = 5, center = true);
        }

        // Clear recessed labels remain legible in one filament colour.
        if (box_labels) for (i = [0 : deck_count - 1]) {
            x = wall + deck_depth / 2 + i * (deck_depth + divider);
            label_cut(
                edition == "iris" ? iris_top[i] : edition == "lodewijk" ? lodewijk_top[i] : nikki_top[i],
                edition == "iris" ? iris_bottom[i] : edition == "lodewijk" ? lodewijk_bottom[i] : nikki_bottom[i],
                x
            );
        }
        // Was hardgecodeerd op 24 terwijl het deksel het werkelijke aantal toont.
        if (box_labels) label_cut(str(coin_total), "MUNTEN", coin_divider_x + divider + coin_bay_depth / 2);
    }
}

module compact_lid() {
    lid_inner_length = box_length + 2 * lid_clearance;
    lid_inner_width = box_width + 2 * lid_clearance;
    lid_length = lid_inner_length + 2 * lid_wall;
    lid_width = lid_inner_width + 2 * lid_wall;
    lid_height = lid_top + lid_skirt;

    difference() {
        rounded_prism([lid_length, lid_width, lid_height], outer_radius + lid_wall);
        translate([lid_wall, lid_wall, lid_top])
            rounded_prism([lid_inner_length, lid_inner_width, lid_skirt + 1], outer_radius + lid_clearance);
        translate([lid_length / 2, lid_width / 2 + 6, -0.1])
            mirror([1, 0, 0]) linear_extrude(height = 0.75)
                text("TRACKBACK", size = 10, font = "Arial:style=Bold", halign = "center", valign = "center");
        translate([lid_length / 2, lid_width / 2 - 7, -0.1])
            mirror([1, 0, 0]) linear_extrude(height = 0.75)
                text(edition_name, size = 7, font = "Arial:style=Bold", halign = "center", valign = "center");
        translate([lid_length / 2, lid_width / 2 - 16, -0.1])
            mirror([1, 0, 0]) linear_extrude(height = 0.75)
                text(edition_subtitle, size = 3.8, font = "Arial:style=Bold", halign = "center", valign = "center");
    }
}

module fit_test() {
    test_length = 26;
    test_width = 26;
    test_height = 12;
    rounded_prism([test_length, test_width, test_height], 4);
    translate([test_length + 8, 0, 0])
        difference() {
            rounded_prism([test_length + 2 * (lid_clearance + lid_wall), test_width + 2 * (lid_clearance + lid_wall), lid_top + lid_skirt], 4 + lid_wall);
            translate([lid_wall, lid_wall, lid_top])
                rounded_prism([test_length + 2 * lid_clearance, test_width + 2 * lid_clearance, lid_skirt + 1], 4 + lid_clearance);
        }
}

if (part == "box") compact_box();
else if (part == "lid") compact_lid();
else if (part == "fit_test") fit_test();

