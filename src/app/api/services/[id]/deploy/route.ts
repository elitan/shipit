import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deployService } from "@/lib/deployer";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const service = await db
    .selectFrom("services")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst();

  if (!service) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const deploymentId = await deployService(id);
    return NextResponse.json({ deployment_id: deploymentId }, { status: 202 });
  } catch (error) {
    console.error(`Deploy failed for service ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Deploy failed" },
      { status: 500 },
    );
  }
}
