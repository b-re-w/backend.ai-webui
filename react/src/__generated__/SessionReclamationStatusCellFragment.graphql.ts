/**
 * @generated SignedSource<<f7c0bee1093c8d1816f860b4fa49554e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SessionReclamationStatusCellFragment$data = {
  readonly id: string;
  readonly idle_checks: string | null | undefined;
  readonly " $fragmentSpreads": FragmentRefs<"LabGpuSessionInfoFragment" | "SessionReclamationStatusPopoverFragment">;
  readonly " $fragmentType": "SessionReclamationStatusCellFragment";
};
export type SessionReclamationStatusCellFragment$key = {
  readonly " $data"?: SessionReclamationStatusCellFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"SessionReclamationStatusCellFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SessionReclamationStatusCellFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "idle_checks",
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "SessionReclamationStatusPopoverFragment"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "LabGpuSessionInfoFragment"
    }
  ],
  "type": "ComputeSessionNode",
  "abstractKey": null
};

(node as any).hash = "d13e8903698fc677c11fa050f4431baf";

export default node;
