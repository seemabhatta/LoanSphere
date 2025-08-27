from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from loguru import logger

from services.loan_data_service import get_loan_data_service

router = APIRouter()


class NeighborRequest(BaseModel):
    node_id: str


class NeighborResponse(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


def _edge_id(source: str, target: str, label: Optional[str] = None) -> str:
    return f"{source}->{target}:{label or ''}"


@router.post("/neighbors", response_model=NeighborResponse)
async def get_neighbors(req: NeighborRequest):
    try:
        node_id = req.node_id or ""
        if ":" in node_id:
            prefix, raw_id = node_id.split(":", 1)
        else:
            # default assume loan
            prefix, raw_id = "loan", node_id

        lds = get_loan_data_service()

        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []

        def add_node(nid: str, label: str):
            nodes.append({"id": nid, "label": label})

        def add_edge(src: str, tgt: str, label: str):
            edges.append({
                "id": _edge_id(src, tgt, label),
                "source": src,
                "target": tgt,
                "label": label,
            })

        if prefix == "loan":
            # Expand from a specific loan
            raw = lds.tinydb.get_loan_data(raw_id)
            if not raw:
                raise HTTPException(status_code=404, detail=f"Loan not found: {raw_id}")
            data = raw.get('loan_data', raw)

            loan_node_id = f"loan:{raw_id}"
            add_node(loan_node_id, f"Loan {raw_id}")

            # Borrower (heuristic)
            borrower_name = None
            for key in ["BorrowerName", "Borrower", "BORROWER_NAME", "borrowerName"]:
                if isinstance(data.get(key), str):
                    borrower_name = data.get(key)
                    break
            if borrower_name:
                bid = f"borrower:{borrower_name}"
                add_node(bid, f"Borrower {borrower_name}")
                add_edge(loan_node_id, bid, "borrower")

            # xp loan number
            evm = data.get('eventMetadata') if isinstance(data, dict) else None
            xp = evm.get('xpLoanNumber') if isinstance(evm, dict) else None
            if xp:
                xid = f"xpn:{xp}"
                add_node(xid, f"XP {xp}")
                add_edge(loan_node_id, xid, "identifier")

            # seller/servicer numbers (scan shallowly)
            def find_values(obj, keys):
                vals = []
                if isinstance(obj, dict):
                    for k, v in obj.items():
                        if k in keys and isinstance(v, (str, int)):
                            vals.append(str(v))
                        vals.extend(find_values(v, keys))
                elif isinstance(obj, list):
                    for it in obj:
                        vals.extend(find_values(it, keys))
                return vals

            sellers = find_values(data, {"sellerNumber", "SellerNumber"})
            servicers = find_values(data, {"servicerNumber", "ServicerNumber"})

            for s in sellers[:4]:
                sid = f"seller:{s}"
                add_node(sid, f"Seller {s}")
                add_edge(loan_node_id, sid, "seller")
            for s in servicers[:4]:
                sid = f"servicer:{s}"
                add_node(sid, f"Servicer {s}")
                add_edge(loan_node_id, sid, "servicer")

            # property
            streets = find_values(data, {"PropertyStreetAddress", "StreetAddress", "PropertyAddress"})
            cities = find_values(data, {"PropertyCity", "City"})
            states = find_values(data, {"PropertyState", "State"})
            zips = find_values(data, {"PropertyPostalCode", "PostalCode", "Zip", "ZipCode"})
            if streets:
                city = cities[0] if cities else ""
                state = states[0] if states else ""
                z = zips[0] if zips else ""
                label = f"{streets[0]} {city} {state} {z}".strip()
                pid = f"property:{label}"
                add_node(pid, f"Property\n{label}")
                add_edge(loan_node_id, pid, "secured_by")

        elif prefix in ("seller", "servicer"):
            # Find loans that reference this seller/servicer across loan data
            key = "sellerNumber" if prefix == "seller" else "servicerNumber"
            add_node(node_id, f"{prefix.capitalize()} {raw_id}")
            all_docs = lds.tinydb.get_all_loan_data()
            def has_value(obj):
                if isinstance(obj, dict):
                    for k, v in obj.items():
                        if k.lower() == key.lower() and str(v) == str(raw_id):
                            return True
                        if has_value(v):
                            return True
                elif isinstance(obj, list):
                    for it in obj:
                        if has_value(it):
                            return True
                return False

            count = 0
            for d in all_docs:
                data = d.get('loan_data', d)
                if has_value(data):
                    lid = d.get('id') or d.get('loan_data_id') or "unknown"
                    loan_node_id = f"loan:{lid}"
                    add_node(loan_node_id, f"Loan {lid}")
                    add_edge(node_id, loan_node_id, "related")
                    count += 1
                    if count >= 10:
                        break
        else:
            # Unsupported type: return empty
            pass

        # De-duplicate nodes by id
        unique_nodes = {}
        for n in nodes:
            unique_nodes[n["id"]] = n
        nodes = list(unique_nodes.values())

        # De-duplicate edges by id
        unique_edges = {}
        for e in edges:
            unique_edges[e["id"]] = e
        edges = list(unique_edges.values())

        return NeighborResponse(nodes=nodes, edges=edges)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Graph neighbors error: {e}")
        raise HTTPException(status_code=500, detail=f"Graph error: {str(e)}")

