class_name IK
extends RefCounted
## Two-bone IK with LENGTH-LOCKED bones.
##
## Hard-won from the JS build: clamping the IK *target* so it never exceeds reach
## is fragile — one bad unit or scale conversion anywhere and limbs stretch into
## noodles. Locking the rendered bone LENGTH instead is a hard guarantee: a bone
## is always exactly its own length. Reachable poses look identical; unreachable
## ones just leave the foot short, which is invisible in play.
##
## Bone meshes are expected to be 1.0-tall cylinders whose length runs along +Y,
## so scale.y == world length.


## Rotation that points a bone's local +Y along `dir`.
static func basis_from_up(dir: Vector3) -> Basis:
	var n := dir.normalized()
	if n.length_squared() < 0.5:
		return Basis.IDENTITY
	# The arc constructor degenerates when the vectors are exactly opposite.
	if n.dot(Vector3.UP) < -0.9999:
		return Basis(Vector3.RIGHT, PI)
	return Basis(Quaternion(Vector3.UP, n))


## Draw `mesh` as a bone of EXACTLY length `bone_len`, anchored at `a`, aimed at `b`.
## It physically cannot stretch, whatever the caller asks for.
static func orient_fixed(mesh: Node3D, a: Vector3, b: Vector3, bone_len: float) -> void:
	var d := b - a
	var n := d.normalized() if d.length_squared() > 1e-10 else Vector3.DOWN
	mesh.position = a + n * (bone_len * 0.5)
	mesh.basis = basis_from_up(n).scaled(Vector3(1.0, bone_len, 1.0))


## Solve a 2-bone chain from `root` to `tip`, elbow/knee breaking toward `bend`.
## Returns the joint position. Both bones are drawn length-locked.
static func solve_two_bone(
	b1: Node3D, b2: Node3D, root: Vector3, tip: Vector3, l1: float, l2: float, bend: Vector3
) -> Vector3:
	var to_tip := tip - root
	var d := to_tip.length()
	if d < 1e-4:
		to_tip = Vector3.DOWN
		d = 1e-4
	var dir := to_tip / d

	var joint: Vector3
	if d >= l1 + l2:
		# Out of reach: point straight at the target. The lock keeps the limb
		# honest — it simply falls short instead of stretching.
		joint = root + dir * (d * (l1 / (l1 + l2)))
	else:
		var pole := bend - dir * bend.dot(dir)
		if pole.length_squared() < 1e-5:
			pole = Vector3.DOWN - dir * dir.y
		pole = pole.normalized()
		var a := (l1 * l1 - l2 * l2 + d * d) / (2.0 * d)
		var h := sqrt(maxf(0.0, l1 * l1 - a * a))
		joint = root + dir * a + pole * h

	# Re-anchor the joint to exactly l1 from the root, then draw both bones at
	# their fixed lengths.
	var kd := joint - root
	var kn := kd.normalized() if kd.length_squared() > 1e-10 else Vector3.DOWN
	var knee := root + kn * l1

	orient_fixed(b1, root, knee, l1)
	orient_fixed(b2, knee, tip, l2)
	return knee
