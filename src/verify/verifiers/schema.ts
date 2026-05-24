import type { Verifier } from "../core/types";

/**
 * Schema verifier — confirms the fixture's props satisfy the unit's Zod
 * schema. Catches the easy lie: "fixture says it tested this" while feeding
 * the component values its props don't even accept.
 */
export const schemaVerifier: Verifier = {
  name: "schema",
  run: ({ unit, fixture }) => {
    const result = unit.propsSchema.safeParse(fixture.props);
    if (result.success) {
      return [
        {
          verifier: "schema",
          name: "props-match-schema",
          status: "ok",
        },
      ];
    }
    return [
      {
        verifier: "schema",
        name: "props-match-schema",
        status: "fail",
        message: result.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; "),
        detail: result.error.issues,
      },
    ];
  },
};
