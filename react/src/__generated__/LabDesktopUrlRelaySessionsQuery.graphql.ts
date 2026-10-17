/**
 * @generated SignedSource<<94475940b42063b88d513d089044bb0e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LabDesktopUrlRelaySessionsQuery$variables = {
  scopeId?: any | null | undefined;
};
export type LabDesktopUrlRelaySessionsQuery$data = {
  readonly compute_session_nodes: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly occupied_slots: string | null | undefined;
        readonly row_id: string | null | undefined;
      } | null | undefined;
    } | null | undefined>;
  } | null | undefined;
};
export type LabDesktopUrlRelaySessionsQuery = {
  response: LabDesktopUrlRelaySessionsQuery$data;
  variables: LabDesktopUrlRelaySessionsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "scopeId"
  }
],
v1 = [
  {
    "kind": "Literal",
    "name": "filter",
    "value": "status == \"RUNNING\""
  },
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  },
  {
    "kind": "Variable",
    "name": "scope_id",
    "variableName": "scopeId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "row_id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "occupied_slots",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "LabDesktopUrlRelaySessionsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "ComputeSessionConnection",
        "kind": "LinkedField",
        "name": "compute_session_nodes",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ComputeSessionEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ComputeSessionNode",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/)
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
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "LabDesktopUrlRelaySessionsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "ComputeSessionConnection",
        "kind": "LinkedField",
        "name": "compute_session_nodes",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ComputeSessionEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ComputeSessionNode",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "id",
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
    ]
  },
  "params": {
    "cacheID": "910983d16b61654ed55b9c78524cf5b5",
    "id": null,
    "metadata": {},
    "name": "LabDesktopUrlRelaySessionsQuery",
    "operationKind": "query",
    "text": "query LabDesktopUrlRelaySessionsQuery(\n  $scopeId: ScopeField\n) {\n  compute_session_nodes(first: 100, filter: \"status == \\\"RUNNING\\\"\", scope_id: $scopeId) {\n    edges {\n      node {\n        row_id\n        occupied_slots\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e6c04e8b8a63a83120061a9e9b08309a";

export default node;
