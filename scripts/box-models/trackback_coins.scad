/*
  TRACKBACK coins — one-colour, support-free

  Set `part` to export:
    "coin"        one loose coin
    "sheet"       24 coins, arranged for an A1 mini
    "holder"      box with four wells of six coins
    "holder_lid"  friction-fit cap lid
*/

$fn = 96;

part = "sheet";

coin_diameter = 26;
coin_thickness = 2.8;
engraving_depth = 0.6;
coin_gap = 3;

holder_size = 64;
holder_height = 21;
holder_bottom = 3;
holder_radius = 5;
well_diameter = 28;
well_centres = [17, 47];

lid_clearance = 0.35;
lid_wall = 2;
lid_top = 2.4;
lid_skirt = 8;

module rounded_prism(size, radius) {
    translate([radius, radius, 0])
        linear_extrude(height = size[2])
            offset(r = radius)
                square([size[0] - 2 * radius, size[1] - 2 * radius]);
}

module coin_body() {
    rotate_extrude()
        polygon([
            [0, 0],
            [coin_diameter / 2 - 0.4, 0],
            [coin_diameter / 2, 0.4],
            [coin_diameter / 2, coin_thickness - 0.4],
            [coin_diameter / 2 - 0.4, coin_thickness],
            [0, coin_thickness]
        ]);
}

module coin() {
    difference() {
        coin_body();

        translate([0, 0, coin_thickness - engraving_depth])
            linear_extrude(height = engraving_depth + 0.2)
                difference() {
                    circle(d = 22);
                    circle(d = 20.8);
                }

        translate([0, 2.2, coin_thickness - engraving_depth])
            linear_extrude(height = engraving_depth + 0.2)
                text(
                    "+1",
                    size = 8,
                    font = "Arial:style=Bold",
                    halign = "center",
                    valign = "center"
                );

        translate([0, -5.5, coin_thickness - engraving_depth])
            linear_extrude(height = engraving_depth + 0.2)
                text(
                    "TRACKBACK",
                    size = 2.1,
                    font = "Arial:style=Bold",
                    halign = "center",
                    valign = "center"
                );
    }
}

module coin_sheet() {
    for (row = [0 : 3]) {
        for (column = [0 : 5]) {
            translate([
                coin_diameter / 2 + column * (coin_diameter + coin_gap),
                coin_diameter / 2 + row * (coin_diameter + coin_gap),
                0
            ]) coin();
        }
    }
}

module holder() {
    difference() {
        rounded_prism([holder_size, holder_size, holder_height], holder_radius);

        for (x = well_centres) {
            for (y = well_centres) {
                translate([x, y, holder_bottom])
                    cylinder(h = holder_height, d = well_diameter);
            }
        }

        // Small thumb scoops make each six-coin stack easy to lift.
        for (x = well_centres) {
            translate([x, -1, holder_height])
                rotate([-90, 0, 0])
                    cylinder(h = holder_size + 2, r = 6);
        }
    }
}

module holder_lid() {
    inner_size = holder_size + 2 * lid_clearance;
    outer_size = inner_size + 2 * lid_wall;
    lid_height = lid_top + lid_skirt;

    difference() {
        rounded_prism([outer_size, outer_size, lid_height], holder_radius + lid_wall);

        translate([lid_wall, lid_wall, lid_top])
            rounded_prism(
                [inner_size, inner_size, lid_skirt + 1],
                holder_radius + lid_clearance
            );

        translate([outer_size / 2, outer_size / 2 + 5, -0.1])
            mirror([1, 0, 0])
                linear_extrude(height = 0.8)
                    text(
                        "TRACKBACK",
                        size = 7,
                        font = "Arial:style=Bold",
                        halign = "center",
                        valign = "center"
                    );

        translate([outer_size / 2, outer_size / 2 - 7, -0.1])
            mirror([1, 0, 0])
                linear_extrude(height = 0.8)
                    text(
                        "24 MUNTEN",
                        size = 5,
                        font = "Arial:style=Bold",
                        halign = "center",
                        valign = "center"
                    );
    }
}

if (part == "coin") {
    coin();
} else if (part == "sheet") {
    coin_sheet();
} else if (part == "holder") {
    holder();
} else if (part == "holder_lid") {
    holder_lid();
}
