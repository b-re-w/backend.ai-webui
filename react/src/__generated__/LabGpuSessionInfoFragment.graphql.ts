/**
 * @generated SignedSource<<59a1316c25ea5ede5c4eb2810689f178>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LabGpuSessionInfoFragment$data = {
  readonly kernel_nodes: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly agent_addr: string | null | undefined;
        readonly cluster_role: string | null | undefined;
        readonly live_stat: string | null | undefined;
      } | null | undefined;
    } | null | undefined>;
  } | null | undefined;
  readonly service_ports: string | null | undefined;
  readonly " $fragmentType": "LabGpuSessionInfoFragment";
};
export type LabGpuSessionInfoFragment$key = {
  readonly " $data"?: LabGpuSessionInfoFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"LabGpuSessionInfoFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "LabGpuSessionInfoFragment",
  "selections": [
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
      "concreteType": "KernelConnection",
      "kind": "LinkedField",
      "name": "kernel_nodes",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "KernelEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "KernelNode",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "cluster_role",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "agent_addr",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "live_stat",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ComputeSessionNode",
  "abstractKey": null
};

(node as any).hash = "4b6b090ad008c9432c8a2d0a61a58bc5";

export default node;
