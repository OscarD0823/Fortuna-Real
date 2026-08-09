use bevy::{
    camera::{Hdr, ScalingMode},
    core_pipeline::tonemapping::Tonemapping,
    pbr::{ScreenSpaceAmbientOcclusion, ScreenSpaceAmbientOcclusionQualityLevel},
    post_process::bloom::Bloom,
    prelude::*,
};
use std::f32::consts::{FRAC_PI_2, TAU};

const TRACK_WIDTH: f32 = 1.86;
const TRACK_TOP: f32 = 0.78;
const CAMERA_POSITION: Vec3 = Vec3::new(0.0, 28.5, 26.0);

#[derive(Component)]
struct FloatingMarble {
    base_height: f32,
    phase: f32,
}

#[derive(Component)]
struct Spinner {
    speed: f32,
}

#[derive(Component)]
struct PulseLight {
    base: f32,
    phase: f32,
}

#[derive(Resource)]
struct SceneMeshes {
    cube: Handle<Mesh>,
    beveled_block: Handle<Mesh>,
    cylinder: Handle<Mesh>,
    cone: Handle<Mesh>,
    sphere: Handle<Mesh>,
    small_sphere: Handle<Mesh>,
}

#[derive(Resource)]
struct SceneMaterials {
    floor: Handle<StandardMaterial>,
    gunmetal: Handle<StandardMaterial>,
    panel: Handle<StandardMaterial>,
    track_top: Handle<StandardMaterial>,
    black: Handle<StandardMaterial>,
    brass: Handle<StandardMaterial>,
    gold_light: Handle<StandardMaterial>,
    cyan: Handle<StandardMaterial>,
    cyan_light: Handle<StandardMaterial>,
    orange_light: Handle<StandardMaterial>,
    purple_light: Handle<StandardMaterial>,
    red_light: Handle<StandardMaterial>,
    green_light: Handle<StandardMaterial>,
    ice: Handle<StandardMaterial>,
    portal_glass: Handle<StandardMaterial>,
}

fn main() {
    App::new()
        .insert_resource(ClearColor(Color::srgb(0.004, 0.012, 0.017)))
        .insert_resource(GlobalAmbientLight {
            color: Color::srgb(0.24, 0.32, 0.37),
            brightness: 1_250.0,
            ..default()
        })
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Fortuna Real - Prototipo nativo de Canicas".into(),
                resolution: (1440, 900).into(),
                resizable: true,
                ..default()
            }),
            ..default()
        }))
        .add_systems(Startup, setup)
        .add_systems(Update, (animate_marbles, spin_mechanisms, pulse_lights))
        .run();
}

fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    asset_server: Res<AssetServer>,
) {
    commands.spawn((
        Camera3d::default(),
        Projection::from(OrthographicProjection {
            scaling_mode: ScalingMode::FixedVertical {
                viewport_height: 19.4,
            },
            ..OrthographicProjection::default_3d()
        }),
        Hdr,
        Msaa::Off,
        Tonemapping::TonyMcMapface,
        Bloom::NATURAL,
        ScreenSpaceAmbientOcclusion {
            quality_level: ScreenSpaceAmbientOcclusionQualityLevel::High,
            ..default()
        },
        Transform::from_translation(CAMERA_POSITION).looking_at(Vec3::new(0.0, 0.0, -0.6), Vec3::Y),
    ));

    commands.spawn((
        DirectionalLight {
            illuminance: 10_500.0,
            shadow_maps_enabled: true,
            ..default()
        },
        Transform::from_xyz(-8.0, 18.0, 11.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));

    commands.spawn((
        DirectionalLight {
            color: Color::srgb(0.25, 0.52, 0.68),
            illuminance: 6_500.0,
            shadow_maps_enabled: false,
            ..default()
        },
        Transform::from_xyz(11.0, 14.0, -9.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));

    commands.spawn((
        PointLight {
            color: Color::srgb(0.0, 0.72, 1.0),
            intensity: 2_600_000.0,
            range: 32.0,
            shadow_maps_enabled: false,
            ..default()
        },
        Transform::from_xyz(-7.0, 8.0, 5.0),
    ));

    commands.spawn((
        PointLight {
            color: Color::srgb(1.0, 0.39, 0.05),
            intensity: 2_200_000.0,
            range: 30.0,
            shadow_maps_enabled: false,
            ..default()
        },
        Transform::from_xyz(8.0, 7.0, -5.0),
    ));

    let scene_meshes = SceneMeshes {
        cube: meshes.add(Cuboid::new(1.0, 1.0, 1.0)),
        beveled_block: meshes.add(Extrusion::new(
            ConvexPolygon::new(vec![
                Vec2::new(-0.36, -0.5),
                Vec2::new(0.36, -0.5),
                Vec2::new(0.5, -0.36),
                Vec2::new(0.5, 0.36),
                Vec2::new(0.36, 0.5),
                Vec2::new(-0.36, 0.5),
                Vec2::new(-0.5, 0.36),
                Vec2::new(-0.5, -0.36),
            ])
            .expect("El perfil biselado debe ser convexo"),
            1.0,
        )),
        cylinder: meshes.add(Cylinder::new(1.0, 1.0)),
        cone: meshes.add(Cone::new(1.0, 1.0)),
        sphere: meshes.add(Sphere::new(1.0).mesh().ico(5).unwrap()),
        small_sphere: meshes.add(Sphere::new(0.18)),
    };
    let scene_materials = create_materials(&mut materials, &asset_server);

    spawn_world(
        &mut commands,
        &scene_meshes,
        &scene_materials,
        &mut materials,
    );
    spawn_interface(&mut commands);
    commands.insert_resource(scene_meshes);
    commands.insert_resource(scene_materials);
}

fn spawn_interface(commands: &mut Commands) {
    commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                left: px(22),
                top: px(18),
                width: px(355),
                height: px(82),
                padding: UiRect::axes(px(18), px(12)),
                flex_direction: FlexDirection::Column,
                justify_content: JustifyContent::Center,
                border: UiRect::all(px(1)),
                border_radius: BorderRadius::all(px(13)),
                ..default()
            },
            BackgroundColor(Color::srgba(0.004, 0.016, 0.023, 0.93)),
            BorderColor::all(Color::srgba(0.0, 0.8, 0.95, 0.28)),
            ZIndex(20),
        ))
        .with_children(|parent| {
            parent.spawn((
                Text::new("FORTUNA REAL"),
                TextFont {
                    font_size: FontSize::Px(30.0),
                    ..default()
                },
                TextColor(Color::srgb(0.86, 0.96, 1.0)),
            ));
            parent.spawn((
                Text::new("CIRCUITO NATIVO 3D  •  MAPA FIJO  •  8 CANICAS"),
                TextFont {
                    font_size: FontSize::Px(11.0),
                    ..default()
                },
                TextColor(Color::srgb(0.0, 0.82, 0.94)),
            ));
        });

    commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                right: px(22),
                top: px(18),
                width: px(235),
                height: px(56),
                padding: UiRect::axes(px(16), px(10)),
                flex_direction: FlexDirection::Column,
                justify_content: JustifyContent::Center,
                border: UiRect::all(px(1)),
                border_radius: BorderRadius::all(px(12)),
                ..default()
            },
            BackgroundColor(Color::srgba(0.004, 0.016, 0.023, 0.9)),
            BorderColor::all(Color::srgba(1.0, 0.52, 0.04, 0.28)),
            ZIndex(20),
        ))
        .with_children(|parent| {
            parent.spawn((
                Text::new("FABRICA FORTUNA"),
                TextFont {
                    font_size: FontSize::Px(16.0),
                    ..default()
                },
                TextColor(Color::srgb(1.0, 0.62, 0.12)),
            ));
            parent.spawn((
                Text::new("Prueba visual • sin carrera"),
                TextFont {
                    font_size: FontSize::Px(11.0),
                    ..default()
                },
                TextColor(Color::srgb(0.56, 0.68, 0.72)),
            ));
        });
}

fn create_materials(
    materials: &mut Assets<StandardMaterial>,
    asset_server: &AssetServer,
) -> SceneMaterials {
    SceneMaterials {
        floor: materials.add(StandardMaterial {
            base_color: Color::srgb(0.004, 0.009, 0.012),
            unlit: true,
            ..default()
        }),
        gunmetal: materials.add(StandardMaterial {
            base_color: Color::srgb(0.075, 0.092, 0.1),
            metallic: 0.92,
            perceptual_roughness: 0.27,
            ..default()
        }),
        panel: materials.add(StandardMaterial {
            base_color: Color::srgb(0.11, 0.125, 0.13),
            metallic: 0.9,
            perceptual_roughness: 0.3,
            ..default()
        }),
        track_top: materials.add(StandardMaterial {
            base_color: Color::srgb(1.0, 1.0, 1.0),
            base_color_texture: Some(asset_server.load("textures/gunmetal-panels-v1.png")),
            metallic: 0.86,
            perceptual_roughness: 0.36,
            ..default()
        }),
        black: materials.add(StandardMaterial {
            base_color: Color::srgb(0.008, 0.012, 0.013),
            metallic: 0.78,
            perceptual_roughness: 0.22,
            ..default()
        }),
        brass: materials.add(StandardMaterial {
            base_color: Color::srgb(0.82, 0.36, 0.045),
            emissive: LinearRgba::rgb(0.16, 0.035, 0.002),
            metallic: 0.94,
            perceptual_roughness: 0.18,
            ..default()
        }),
        gold_light: emissive_material(materials, Color::srgb(1.0, 0.52, 0.04), 1.1),
        cyan: materials.add(StandardMaterial {
            base_color: Color::srgb(0.0, 0.28, 0.34),
            metallic: 0.58,
            perceptual_roughness: 0.22,
            ..default()
        }),
        cyan_light: emissive_material(materials, Color::srgb(0.0, 0.82, 1.0), 1.7),
        orange_light: emissive_material(materials, Color::srgb(1.0, 0.2, 0.015), 1.35),
        purple_light: emissive_material(materials, Color::srgb(0.56, 0.03, 1.0), 1.55),
        red_light: emissive_material(materials, Color::srgb(1.0, 0.035, 0.015), 1.3),
        green_light: emissive_material(materials, Color::srgb(0.28, 1.0, 0.025), 1.25),
        ice: materials.add(StandardMaterial {
            base_color: Color::srgba(0.16, 0.68, 1.0, 0.54),
            emissive: Color::srgb(0.0, 0.22, 0.5).into(),
            metallic: 0.05,
            perceptual_roughness: 0.08,
            alpha_mode: AlphaMode::Blend,
            ..default()
        }),
        portal_glass: materials.add(StandardMaterial {
            base_color: Color::srgba(0.19, 0.01, 0.38, 0.56),
            emissive: LinearRgba::rgb(1.5, 0.05, 3.2),
            metallic: 0.05,
            perceptual_roughness: 0.08,
            alpha_mode: AlphaMode::Add,
            ..default()
        }),
    }
}

fn emissive_material(
    materials: &mut Assets<StandardMaterial>,
    color: Color,
    strength: f32,
) -> Handle<StandardMaterial> {
    materials.add(StandardMaterial {
        base_color: color,
        emissive: color.to_linear() * strength,
        metallic: 0.35,
        perceptual_roughness: 0.14,
        ..default()
    })
}

fn spawn_world(
    commands: &mut Commands,
    meshes: &SceneMeshes,
    mats: &SceneMaterials,
    materials: &mut Assets<StandardMaterial>,
) {
    spawn_floor(commands, meshes, mats);

    let track = sample_closed_track(&fixed_track_points(), 6);
    spawn_track(commands, meshes, mats, &track);

    spawn_round_platform(commands, meshes, mats, Vec3::new(-5.8, 0.35, 2.15), 1.7);
    spawn_round_platform(commands, meshes, mats, Vec3::new(0.7, 0.47, 0.6), 1.85);
    spawn_round_platform(commands, meshes, mats, Vec3::new(7.4, 0.35, 3.35), 1.65);
    spawn_round_platform(commands, meshes, mats, Vec3::new(5.4, 0.35, -5.4), 1.55);
    spawn_round_platform(commands, meshes, mats, Vec3::new(-3.7, 0.35, -5.55), 1.65);

    spawn_turbine(commands, meshes, mats, Vec3::new(-5.8, 1.0, 2.15), 1.25);
    spawn_turbine(commands, meshes, mats, Vec3::new(7.4, 1.0, 3.35), 1.2);
    spawn_turbine(commands, meshes, mats, Vec3::new(-3.7, 1.0, -5.55), 1.15);

    spawn_cannon(commands, meshes, mats, Vec3::new(-8.0, 1.55, 6.0), -0.72);
    spawn_cannon(commands, meshes, mats, Vec3::new(3.6, 1.45, -4.3), 0.32);
    spawn_cannon(commands, meshes, mats, Vec3::new(9.3, 1.4, 0.8), 1.1);
    spawn_pipe_bridge(commands, meshes, mats, Vec3::new(-5.1, 0.6, 5.9), 0.9);

    spawn_portal(commands, meshes, mats, Vec3::new(-9.1, 1.0, 5.35));
    spawn_ice_zone(commands, meshes, mats, Vec3::new(4.9, 1.0, -5.1));
    spawn_power_core(commands, meshes, mats, Vec3::new(-3.15, 1.1, 2.9));

    spawn_boost_strip(commands, meshes, mats, Vec3::new(-8.7, 1.02, 0.3), -0.18, 5);
    spawn_boost_strip(commands, meshes, mats, Vec3::new(2.1, 1.15, -4.35), 0.7, 5);
    spawn_boost_strip(commands, meshes, mats, Vec3::new(8.0, 1.03, -4.7), -0.65, 5);
    spawn_warning_strip(commands, meshes, mats, Vec3::new(7.7, 1.0, -1.7), 1.0, 4);

    spawn_marbles(commands, meshes, materials, &track);
    spawn_edge_lights(commands, meshes, mats);
}

fn spawn_floor(commands: &mut Commands, meshes: &SceneMeshes, mats: &SceneMaterials) {
    commands.spawn((
        Mesh3d(meshes.cube.clone()),
        MeshMaterial3d(mats.black.clone()),
        Transform::from_xyz(0.0, -0.78, 0.0).with_scale(Vec3::new(29.4, 0.34, 19.7)),
    ));
    commands.spawn((
        Mesh3d(meshes.cube.clone()),
        MeshMaterial3d(mats.floor.clone()),
        Transform::from_xyz(0.0, -0.48, 0.0).with_scale(Vec3::new(28.6, 0.34, 18.9)),
    ));

    for x in [-14.35, 14.35] {
        commands.spawn((
            Mesh3d(meshes.cube.clone()),
            MeshMaterial3d(mats.gunmetal.clone()),
            Transform::from_xyz(x, -0.2, 0.0).with_scale(Vec3::new(0.38, 0.58, 19.35)),
        ));
    }
    for z in [-9.55, 9.55] {
        commands.spawn((
            Mesh3d(meshes.cube.clone()),
            MeshMaterial3d(mats.gunmetal.clone()),
            Transform::from_xyz(0.0, -0.2, z).with_scale(Vec3::new(29.05, 0.58, 0.38)),
        ));
    }

    for x in [-14.14, 14.14] {
        commands.spawn((
            Mesh3d(meshes.cube.clone()),
            MeshMaterial3d(mats.brass.clone()),
            Transform::from_xyz(x, 0.08, 0.0).with_scale(Vec3::new(0.055, 0.07, 18.85)),
        ));
    }
}

fn fixed_track_points() -> Vec<Vec3> {
    vec![
        Vec3::new(-10.5, 0.05, 5.8),
        Vec3::new(-12.0, 0.05, 3.3),
        Vec3::new(-10.5, 0.05, 0.2),
        Vec3::new(-7.7, 0.08, -1.0),
        Vec3::new(-10.5, 0.05, -3.7),
        Vec3::new(-9.0, 0.05, -7.0),
        Vec3::new(-5.0, 0.1, -8.0),
        Vec3::new(-1.8, 0.14, -6.3),
        Vec3::new(-4.0, 0.1, -4.0),
        Vec3::new(-6.8, 0.06, -3.0),
        Vec3::new(-5.0, 0.08, -0.4),
        Vec3::new(-2.0, 0.42, 0.4),
        Vec3::new(0.4, 0.72, 2.6),
        Vec3::new(3.0, 0.48, 4.8),
        Vec3::new(6.6, 0.08, 6.7),
        Vec3::new(10.4, 0.05, 5.3),
        Vec3::new(11.4, 0.05, 2.2),
        Vec3::new(9.0, 0.06, 0.1),
        Vec3::new(11.2, 0.05, -2.2),
        Vec3::new(10.4, 0.05, -6.4),
        Vec3::new(6.7, 0.05, -8.0),
        Vec3::new(3.7, 0.08, -6.3),
        Vec3::new(5.5, 0.12, -3.3),
        Vec3::new(3.5, 0.35, -1.4),
        Vec3::new(1.0, 0.65, -3.4),
        Vec3::new(-1.3, 0.45, -2.5),
        Vec3::new(-0.4, 0.3, 0.3),
        Vec3::new(2.0, 0.15, 1.2),
        Vec3::new(3.8, 0.08, -0.2),
        Vec3::new(5.9, 0.05, 1.7),
        Vec3::new(4.0, 0.08, 3.8),
        Vec3::new(1.4, 0.15, 5.8),
        Vec3::new(-1.8, 0.08, 6.6),
        Vec3::new(-4.8, 0.05, 5.2),
        Vec3::new(-7.0, 0.05, 6.8),
    ]
}

fn sample_closed_track(points: &[Vec3], samples_per_segment: usize) -> Vec<Vec3> {
    let mut sampled = Vec::with_capacity(points.len() * samples_per_segment);
    let count = points.len();

    for index in 0..count {
        let p0 = points[(index + count - 1) % count];
        let p1 = points[index];
        let p2 = points[(index + 1) % count];
        let p3 = points[(index + 2) % count];

        for step in 0..samples_per_segment {
            let t = step as f32 / samples_per_segment as f32;
            let t2 = t * t;
            let t3 = t2 * t;
            sampled.push(
                0.5 * ((2.0 * p1)
                    + (-p0 + p2) * t
                    + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
                    + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3),
            );
        }
    }

    sampled
}

fn spawn_track(
    commands: &mut Commands,
    meshes: &SceneMeshes,
    mats: &SceneMaterials,
    track: &[Vec3],
) {
    for index in 0..track.len() {
        let start = track[index];
        let end = track[(index + 1) % track.len()];
        let delta = end - start;
        let length = Vec2::new(delta.x, delta.z).length();
        if length < 0.02 {
            continue;
        }

        let direction = Vec3::new(delta.x / length, 0.0, delta.z / length);
        let side = Vec3::new(-direction.z, 0.0, direction.x);
        let midpoint = (start + end) * 0.5 + Vec3::Y * TRACK_TOP;
        let yaw = delta.x.atan2(delta.z);
        let rotation = Quat::from_rotation_y(yaw);
        let block_rotation = rotation * Quat::from_rotation_x(FRAC_PI_2);

        // Chasis grueso: la pista ya no parece una cinta plana apoyada en el suelo.
        commands.spawn((
            Mesh3d(meshes.beveled_block.clone()),
            MeshMaterial3d(mats.black.clone()),
            Transform::from_translation(midpoint - Vec3::Y * 0.16)
                .with_rotation(block_rotation)
                .with_scale(Vec3::new(TRACK_WIDTH * 1.12, length * 1.34, 0.62)),
        ));
        commands.spawn((
            Mesh3d(meshes.beveled_block.clone()),
            MeshMaterial3d(mats.gunmetal.clone()),
            Transform::from_translation(midpoint + Vec3::Y * 0.02)
                .with_rotation(block_rotation)
                .with_scale(Vec3::new(TRACK_WIDTH, length * 1.3, 0.42)),
        ));
        commands.spawn((
            Mesh3d(meshes.beveled_block.clone()),
            MeshMaterial3d(mats.track_top.clone()),
            Transform::from_translation(midpoint + Vec3::Y * 0.265)
                .with_rotation(block_rotation)
                .with_scale(Vec3::new(TRACK_WIDTH * 0.76, length * 1.24, 0.075)),
        ));

        let power_zone = matches!(index, 18..=35 | 76..=94 | 142..=159);
        let danger_zone = matches!(index, 107..=119 | 176..=186);
        if power_zone || danger_zone {
            commands.spawn((
                Mesh3d(meshes.beveled_block.clone()),
                MeshMaterial3d(if power_zone {
                    mats.cyan_light.clone()
                } else {
                    mats.red_light.clone()
                }),
                Transform::from_translation(midpoint + Vec3::Y * 0.317)
                    .with_rotation(block_rotation)
                    .with_scale(Vec3::new(0.055, length * 1.22, 0.028)),
            ));
        }

        for edge in [-1.0, 1.0] {
            // Muro lateral oscuro, placa exterior y un filete de latón muy fino.
            commands.spawn((
                Mesh3d(meshes.beveled_block.clone()),
                MeshMaterial3d(mats.gunmetal.clone()),
                Transform::from_translation(
                    midpoint + side * edge * (TRACK_WIDTH * 0.51) + Vec3::Y * 0.18,
                )
                .with_rotation(block_rotation)
                .with_scale(Vec3::new(0.34, length * 1.37, 0.68)),
            ));
            commands.spawn((
                Mesh3d(meshes.beveled_block.clone()),
                MeshMaterial3d(mats.panel.clone()),
                Transform::from_translation(
                    midpoint + side * edge * (TRACK_WIDTH * 0.585) + Vec3::Y * 0.12,
                )
                .with_rotation(block_rotation)
                .with_scale(Vec3::new(0.15, length * 1.39, 0.36)),
            ));
            commands.spawn((
                Mesh3d(meshes.cube.clone()),
                MeshMaterial3d(mats.brass.clone()),
                Transform::from_translation(
                    midpoint + side * edge * (TRACK_WIDTH * 0.59) + Vec3::Y * 0.54,
                )
                .with_rotation(rotation)
                .with_scale(Vec3::new(0.065, 0.105, length * 1.4)),
            ));

            if index % 4 == 0 {
                commands.spawn((
                    Mesh3d(meshes.small_sphere.clone()),
                    MeshMaterial3d(mats.gold_light.clone()),
                    Transform::from_translation(
                        midpoint + side * edge * (TRACK_WIDTH * 0.59) + Vec3::Y * 0.62,
                    )
                    .with_scale(Vec3::splat(0.42)),
                ));
            }
        }

        if index % 3 == 0 {
            commands.spawn((
                Mesh3d(meshes.cube.clone()),
                MeshMaterial3d(mats.black.clone()),
                Transform::from_translation(midpoint + Vec3::Y * 0.315)
                    .with_rotation(rotation)
                    .with_scale(Vec3::new(TRACK_WIDTH * 0.76, 0.028, 0.045)),
            ));
        }

        if index % 10 == 0 {
            commands.spawn((
                Mesh3d(meshes.cube.clone()),
                MeshMaterial3d(mats.black.clone()),
                Transform::from_translation(midpoint - Vec3::Y * (0.7 + start.y))
                    .with_scale(Vec3::new(0.7, 1.12 + start.y * 2.0, 0.7)),
            ));
        }
    }
}

fn spawn_round_platform(
    commands: &mut Commands,
    meshes: &SceneMeshes,
    mats: &SceneMaterials,
    center: Vec3,
    radius: f32,
) {
    commands.spawn((
        Mesh3d(meshes.cylinder.clone()),
        MeshMaterial3d(mats.black.clone()),
        Transform::from_translation(center).with_scale(Vec3::new(
            radius * 1.12,
            0.55,
            radius * 1.12,
        )),
    ));
    commands.spawn((
        Mesh3d(meshes.cylinder.clone()),
        MeshMaterial3d(mats.gunmetal.clone()),
        Transform::from_translation(center + Vec3::Y * 0.34).with_scale(Vec3::new(
            radius * 0.96,
            0.22,
            radius * 0.96,
        )),
    ));
    commands.spawn((
        Mesh3d(meshes.cylinder.clone()),
        MeshMaterial3d(mats.track_top.clone()),
        Transform::from_translation(center + Vec3::Y * 0.54).with_scale(Vec3::new(
            radius * 0.72,
            0.055,
            radius * 0.72,
        )),
    ));

    for tooth in 0..18 {
        let angle = tooth as f32 / 18.0 * TAU;
        let position = center
            + Vec3::new(
                angle.cos() * radius * 0.92,
                0.5,
                angle.sin() * radius * 0.92,
            );
        commands.spawn((
            Mesh3d(meshes.cube.clone()),
            MeshMaterial3d(mats.brass.clone()),
            Transform::from_translation(position)
                .with_rotation(Quat::from_rotation_y(-angle))
                .with_scale(Vec3::new(0.16, 0.32, 0.46)),
        ));

        if tooth % 3 == 0 {
            commands.spawn((
                Mesh3d(meshes.small_sphere.clone()),
                MeshMaterial3d(mats.cyan_light.clone()),
                Transform::from_translation(position + Vec3::Y * 0.23)
                    .with_scale(Vec3::splat(0.28)),
            ));
        }
    }
}

fn spawn_turbine(
    commands: &mut Commands,
    meshes: &SceneMeshes,
    mats: &SceneMaterials,
    center: Vec3,
    radius: f32,
) {
    commands.spawn((
        Mesh3d(meshes.cylinder.clone()),
        MeshMaterial3d(mats.brass.clone()),
        Transform::from_translation(center).with_scale(Vec3::new(0.38, 0.45, 0.38)),
        Spinner { speed: 0.7 },
    ));

    let parent = commands
        .spawn((
            Transform::from_translation(center + Vec3::Y * 0.32),
            Spinner { speed: 0.42 },
        ))
        .id();
    commands.entity(parent).with_children(|builder| {
        for blade in 0..8 {
            let angle = blade as f32 / 8.0 * TAU;
            builder.spawn((
                Mesh3d(meshes.cube.clone()),
                MeshMaterial3d(mats.panel.clone()),
                Transform::from_xyz(
                    angle.cos() * radius * 0.45,
                    0.0,
                    angle.sin() * radius * 0.45,
                )
                .with_rotation(Quat::from_rotation_y(-angle + 0.35))
                .with_scale(Vec3::new(radius * 0.72, 0.12, 0.28)),
            ));
        }
    });

    commands.spawn((
        Mesh3d(meshes.sphere.clone()),
        MeshMaterial3d(mats.cyan_light.clone()),
        Transform::from_translation(center + Vec3::Y * 0.52).with_scale(Vec3::splat(0.23)),
    ));
}

fn spawn_cannon(
    commands: &mut Commands,
    meshes: &SceneMeshes,
    mats: &SceneMaterials,
    center: Vec3,
    yaw: f32,
) {
    let direction = Vec3::new(yaw.sin(), 0.0, yaw.cos());
    let side = Vec3::new(-direction.z, 0.0, direction.x);
    commands.spawn((
        Mesh3d(meshes.cylinder.clone()),
        MeshMaterial3d(mats.black.clone()),
        Transform::from_translation(center - Vec3::Y * 0.45)
            .with_scale(Vec3::new(1.08, 0.52, 1.08)),
    ));
    commands.spawn((
        Mesh3d(meshes.cylinder.clone()),
        MeshMaterial3d(mats.brass.clone()),
        Transform::from_translation(center - Vec3::Y * 0.12)
            .with_scale(Vec3::new(0.82, 0.18, 0.82)),
    ));

    let rotation = Quat::from_rotation_y(yaw) * Quat::from_rotation_x(FRAC_PI_2);
    commands.spawn((
        Mesh3d(meshes.cylinder.clone()),
        MeshMaterial3d(mats.gunmetal.clone()),
        Transform::from_translation(center + Vec3::Y * 0.22)
            .with_rotation(rotation)
            .with_scale(Vec3::new(0.48, 2.9, 0.48)),
    ));

    for offset in [-1.0, -0.25, 0.62, 1.38] {
        commands.spawn((
            Mesh3d(meshes.cylinder.clone()),
            MeshMaterial3d(mats.brass.clone()),
            Transform::from_translation(center + direction * offset + Vec3::Y * 0.22)
                .with_rotation(rotation)
                .with_scale(Vec3::new(
                    if offset > 1.0 { 0.66 } else { 0.55 },
                    0.18,
                    if offset > 1.0 { 0.66 } else { 0.55 },
                )),
        ));
    }
    commands.spawn((
        Mesh3d(meshes.cylinder.clone()),
        MeshMaterial3d(mats.orange_light.clone()),
        Transform::from_translation(center + direction * 1.51 + Vec3::Y * 0.22)
            .with_rotation(rotation)
            .with_scale(Vec3::new(0.31, 0.08, 0.31)),
    ));

    for edge in [-1.0, 1.0] {
        commands.spawn((
            Mesh3d(meshes.cube.clone()),
            MeshMaterial3d(mats.panel.clone()),
            Transform::from_translation(center + side * edge * 0.56 - Vec3::Y * 0.18)
                .with_rotation(Quat::from_rotation_y(yaw))
                .with_scale(Vec3::new(0.24, 0.9, 0.5)),
        ));
    }
}

fn spawn_pipe_bridge(
    commands: &mut Commands,
    meshes: &SceneMeshes,
    mats: &SceneMaterials,
    center: Vec3,
    yaw: f32,
) {
    let direction = Vec3::new(yaw.sin(), 0.0, yaw.cos());
    let side = Vec3::new(-direction.z, 0.0, direction.x);
    for offset in [-0.46, 0.46] {
        commands.spawn((
            Mesh3d(meshes.cylinder.clone()),
            MeshMaterial3d(mats.brass.clone()),
            Transform::from_translation(center + side * offset + Vec3::Y * 1.4)
                .with_rotation(Quat::from_rotation_y(yaw) * Quat::from_rotation_x(FRAC_PI_2))
                .with_scale(Vec3::new(0.22, 2.3, 0.22)),
        ));
    }
    for support in [-1.75, 1.75] {
        commands.spawn((
            Mesh3d(meshes.cube.clone()),
            MeshMaterial3d(mats.gunmetal.clone()),
            Transform::from_translation(center + direction * support + Vec3::Y * 0.45)
                .with_scale(Vec3::new(0.35, 1.9, 0.35)),
        ));
    }
}

fn spawn_portal(
    commands: &mut Commands,
    meshes: &SceneMeshes,
    mats: &SceneMaterials,
    center: Vec3,
) {
    commands.spawn((
        Mesh3d(meshes.cylinder.clone()),
        MeshMaterial3d(mats.black.clone()),
        Transform::from_translation(center - Vec3::Y * 0.48)
            .with_scale(Vec3::new(1.85, 0.32, 1.85)),
    ));
    commands.spawn((
        Mesh3d(meshes.cylinder.clone()),
        MeshMaterial3d(mats.portal_glass.clone()),
        Transform::from_translation(center - Vec3::Y * 0.12)
            .with_scale(Vec3::new(1.48, 0.045, 1.48)),
    ));
    commands.spawn((
        PointLight {
            color: Color::srgb(0.55, 0.05, 1.0),
            intensity: 650_000.0,
            range: 8.0,
            ..default()
        },
        Transform::from_translation(center + Vec3::Y * 0.3),
        PulseLight {
            base: 650_000.0,
            phase: 0.0,
        },
    ));

    for ring in 0..4 {
        let radius = 0.42 + ring as f32 * 0.31;
        let count = 12 + ring * 4;
        let parent = commands
            .spawn((
                Transform::from_translation(center + Vec3::Y * (0.01 + ring as f32 * 0.045)),
                Spinner {
                    speed: if ring % 2 == 0 {
                        0.42 + ring as f32 * 0.13
                    } else {
                        -0.35 - ring as f32 * 0.11
                    },
                },
            ))
            .id();
        commands.entity(parent).with_children(|builder| {
            for spark in 0..count {
                let angle = spark as f32 / count as f32 * TAU + ring as f32 * 0.28;
                builder.spawn((
                    Mesh3d(meshes.cube.clone()),
                    MeshMaterial3d(mats.purple_light.clone()),
                    Transform::from_xyz(angle.cos() * radius, 0.0, angle.sin() * radius)
                        .with_rotation(Quat::from_rotation_y(-angle + 0.45))
                        .with_scale(Vec3::new(0.08, 0.035, 0.32 + ring as f32 * 0.035)),
                ));
            }
        });
    }
}

fn spawn_ice_zone(
    commands: &mut Commands,
    meshes: &SceneMeshes,
    mats: &SceneMaterials,
    center: Vec3,
) {
    commands.spawn((
        Mesh3d(meshes.cube.clone()),
        MeshMaterial3d(mats.black.clone()),
        Transform::from_translation(center - Vec3::Y * 0.32).with_scale(Vec3::new(5.0, 0.28, 1.25)),
    ));
    for crystal in 0..11 {
        let x = (crystal as f32 - 5.0) * 0.43;
        let height = 1.15 + ((crystal * 7) % 5) as f32 * 0.32;
        let z = if crystal % 2 == 0 { 0.22 } else { -0.16 };
        commands.spawn((
            Mesh3d(meshes.cone.clone()),
            MeshMaterial3d(mats.ice.clone()),
            Transform::from_translation(center + Vec3::new(x, height * 0.48, z))
                .with_rotation(Quat::from_rotation_z((crystal as f32 - 5.0) * 0.035))
                .with_scale(Vec3::new(0.34, height, 0.34)),
        ));
    }
    commands.spawn((
        PointLight {
            color: Color::srgb(0.1, 0.62, 1.0),
            intensity: 550_000.0,
            range: 7.0,
            ..default()
        },
        Transform::from_translation(center + Vec3::Y * 1.4),
        PulseLight {
            base: 550_000.0,
            phase: 1.7,
        },
    ));
}

fn spawn_power_core(
    commands: &mut Commands,
    meshes: &SceneMeshes,
    mats: &SceneMaterials,
    center: Vec3,
) {
    spawn_round_platform(commands, meshes, mats, center - Vec3::Y * 0.55, 1.3);
    commands.spawn((
        Mesh3d(meshes.sphere.clone()),
        MeshMaterial3d(mats.green_light.clone()),
        Transform::from_translation(center).with_scale(Vec3::splat(0.48)),
        FloatingMarble {
            base_height: center.y,
            phase: 0.4,
        },
    ));
    commands.spawn((
        PointLight {
            color: Color::srgb(0.32, 1.0, 0.04),
            intensity: 560_000.0,
            range: 7.0,
            ..default()
        },
        Transform::from_translation(center + Vec3::Y * 0.3),
        PulseLight {
            base: 560_000.0,
            phase: 0.6,
        },
    ));
}

fn spawn_boost_strip(
    commands: &mut Commands,
    meshes: &SceneMeshes,
    mats: &SceneMaterials,
    center: Vec3,
    yaw: f32,
    count: usize,
) {
    let direction = Vec3::new(yaw.sin(), 0.0, yaw.cos());
    let side = Vec3::new(-direction.z, 0.0, direction.x);
    commands.spawn((
        Mesh3d(meshes.cube.clone()),
        MeshMaterial3d(mats.cyan.clone()),
        Transform::from_translation(center - Vec3::Y * 0.035)
            .with_rotation(Quat::from_rotation_y(yaw))
            .with_scale(Vec3::new(0.92, 0.055, count as f32 * 0.51)),
    ));
    for arrow in 0..count {
        let offset = (arrow as f32 - (count - 1) as f32 * 0.5) * 0.48;
        for wing in [-1.0, 1.0] {
            commands.spawn((
                Mesh3d(meshes.cube.clone()),
                MeshMaterial3d(mats.cyan_light.clone()),
                Transform::from_translation(center + direction * offset + side * wing * 0.22)
                    .with_rotation(Quat::from_rotation_y(yaw + wing * 0.64))
                    .with_scale(Vec3::new(0.09, 0.035, 0.38)),
            ));
        }
    }
}

fn spawn_warning_strip(
    commands: &mut Commands,
    meshes: &SceneMeshes,
    mats: &SceneMaterials,
    center: Vec3,
    yaw: f32,
    count: usize,
) {
    let direction = Vec3::new(yaw.sin(), 0.0, yaw.cos());
    for index in 0..count {
        let offset = (index as f32 - (count - 1) as f32 * 0.5) * 0.58;
        commands.spawn((
            Mesh3d(meshes.cube.clone()),
            MeshMaterial3d(if index % 2 == 0 {
                mats.red_light.clone()
            } else {
                mats.orange_light.clone()
            }),
            Transform::from_translation(center + direction * offset)
                .with_rotation(Quat::from_rotation_y(yaw + 0.72))
                .with_scale(Vec3::new(0.12, 0.04, 0.62)),
        ));
    }
}

fn spawn_marbles(
    commands: &mut Commands,
    meshes: &SceneMeshes,
    materials: &mut Assets<StandardMaterial>,
    track: &[Vec3],
) {
    let marble_colors = [
        (Color::srgb(1.0, 0.54, 0.02), Color::srgb(1.0, 0.15, 0.0)),
        (Color::srgb(0.0, 0.9, 0.94), Color::srgb(0.0, 0.24, 0.36)),
        (Color::srgb(0.02, 0.33, 1.0), Color::srgb(0.0, 0.76, 1.0)),
        (Color::srgb(0.61, 0.08, 0.96), Color::srgb(0.9, 0.1, 1.0)),
        (Color::srgb(0.95, 0.04, 0.025), Color::srgb(1.0, 0.38, 0.02)),
        (Color::srgb(1.0, 0.34, 0.015), Color::srgb(1.0, 0.72, 0.04)),
        (Color::srgb(0.24, 0.9, 0.025), Color::srgb(0.62, 1.0, 0.05)),
        (Color::srgb(0.98, 0.08, 0.55), Color::srgb(1.0, 0.2, 0.9)),
    ];
    let positions = [12, 38, 63, 89, 112, 137, 164, 191];

    for (index, track_index) in positions.into_iter().enumerate() {
        let point = track[track_index % track.len()] + Vec3::Y * 1.72;
        let (base, glow) = marble_colors[index];
        let material = materials.add(StandardMaterial {
            base_color: base,
            emissive: glow.to_linear() * 0.42,
            metallic: 0.65,
            perceptual_roughness: 0.08,
            ..default()
        });

        commands.spawn((
            Mesh3d(meshes.sphere.clone()),
            MeshMaterial3d(material.clone()),
            Transform::from_translation(point).with_scale(Vec3::splat(0.53)),
            FloatingMarble {
                base_height: point.y,
                phase: index as f32 * 0.78,
            },
        ));

        commands.spawn((
            Mesh3d(meshes.cylinder.clone()),
            MeshMaterial3d(materials.add(StandardMaterial {
                base_color: Color::srgba(0.01, 0.02, 0.025, 0.82),
                metallic: 0.55,
                perceptual_roughness: 0.22,
                alpha_mode: AlphaMode::Blend,
                ..default()
            })),
            Transform::from_translation(point - Vec3::Y * 0.56)
                .with_scale(Vec3::new(0.61, 0.035, 0.61)),
        ));
    }
}

fn spawn_edge_lights(commands: &mut Commands, meshes: &SceneMeshes, mats: &SceneMaterials) {
    for (index, x) in [-13.2, -8.8, -4.4, 0.0, 4.4, 8.8, 13.2]
        .into_iter()
        .enumerate()
    {
        let material = if index % 2 == 0 {
            mats.cyan_light.clone()
        } else {
            mats.gold_light.clone()
        };
        for z in [-9.5, 9.5] {
            commands.spawn((
                Mesh3d(meshes.cube.clone()),
                MeshMaterial3d(material.clone()),
                Transform::from_xyz(x, -0.02, z).with_scale(Vec3::new(1.3, 0.045, 0.08)),
            ));
        }
    }
}

fn animate_marbles(time: Res<Time>, mut query: Query<(&FloatingMarble, &mut Transform)>) {
    for (floating, mut transform) in &mut query {
        transform.translation.y =
            floating.base_height + (time.elapsed_secs() * 1.7 + floating.phase).sin() * 0.075;
        transform.rotate_y(time.delta_secs() * 0.65);
    }
}

fn spin_mechanisms(time: Res<Time>, mut query: Query<(&Spinner, &mut Transform)>) {
    for (spinner, mut transform) in &mut query {
        transform.rotate_y(time.delta_secs() * spinner.speed);
    }
}

fn pulse_lights(time: Res<Time>, mut query: Query<(&PulseLight, &mut PointLight)>) {
    for (pulse, mut light) in &mut query {
        let wave = (time.elapsed_secs() * 2.0 + pulse.phase).sin() * 0.18 + 0.82;
        light.intensity = pulse.base * wave;
    }
}
