/**
 * @generated SignedSource<<5218cb4e3873f9f6da7f7592bf301e89>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SessionActionButtonsFragment$data = {
  readonly access_key: string | null | undefined;
  readonly commit_status: string | null | undefined;
  readonly id: string;
  readonly name: string | null | undefined;
  readonly row_id: string;
  readonly service_ports: string | null | undefined;
  readonly session_permissions: ReadonlyArray<any | null | undefined> | null | undefined;
  readonly status: string | null | undefined;
  readonly type: string | null | undefined;
  readonly user_id: string | null | undefined;
  readonly " $fragmentSpreads": FragmentRefs<"AppLauncherModalFragment" | "ContainerCommitModalFragment" | "ContainerLogModalFragment" | "SFTPConnectionInfoModalFragment" | "TerminateSessionModalFragment" | "useBackendAIAppLauncherFragment">;
  readonly " $fragmentType": "SessionActionButtonsFragment";
} | null | undefined;
export type SessionActionButtonsFragment$key = {
  readonly " $data"?: SessionActionButtonsFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"SessionActionButtonsFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SessionActionButtonsFragment",
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
      "name": "name",
      "storageKey": null
    },
    {
      "kind": "RequiredField",
      "field": {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "row_id",
        "storageKey": null
      },
      "action": "NONE"
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "type",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "status",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "access_key",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "service_ports",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "commit_status",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "user_id",
      "storageKey": null
    },
    {
      "alias": "session_permissions",
      "args": null,
      "kind": "ScalarField",
      "name": "permissions",
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "TerminateSessionModalFragment"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "ContainerLogModalFragment"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "ContainerCommitModalFragment"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "AppLauncherModalFragment"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "SFTPConnectionInfoModalFragment"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "useBackendAIAppLauncherFragment"
    }
  ],
  "type": "ComputeSessionNode",
  "abstractKey": null
};

(node as any).hash = "f3094006bbaa9e7824277b05c697e52d";

export default node;
