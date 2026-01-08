import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deployService } from "@/lib/deployer";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  console.log(`[deploy] POST /api/services/${id}/deploy called`);

  const service = await db
    .selectFrom("services")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst();

  if (!service) {
    console.log(`[deploy] Service ${id} not found`);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  console.log(`[deploy] Starting deployment for service ${id}`);
  try {
    const deploymentId = await deployService(id);
    console.log(`[deploy] Deployment started: ${deploymentId}`);
    return NextResponse.json({ deployment_id: deploymentId }, { status: 202 });
  } catch (error) {
    console.error(`[deploy] Error deploying service ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Deploy failed" },
      { status: 500 },
    );
  }
}
