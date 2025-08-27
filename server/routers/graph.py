from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from loguru import logger

from services.loan_data_service import get_loan_data_service
import glob, json, os

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
        # Special handling for generic JSON explorer nodes: json:<loanId>:<path>
        if node_id.startswith("json:"):
            rem = node_id[len("json:"):]
            if ":" in rem:
                loan_id, jpath = rem.split(":", 1)
            else:
                loan_id, jpath = rem, "/"

            def load_json_for_loan(loan_id: str):
                lds = get_loan_data_service()
                raw = lds.tinydb.get_loan_data(loan_id)
                if raw and isinstance(raw, dict):
                    return raw.get('loan_data', raw)
                # Fallback: first sample in attached_assets
                try:
                    samples = sorted(glob.glob(os.path.join('attached_assets', '*loan-data*.json')))
                    if samples:
                        with open(samples[0], 'r') as f:
                            return json.load(f)
                except Exception as e:
                    logger.error(f"JSON explorer fallback load failed: {e}")
                return None

            data = load_json_for_loan(loan_id)
            if data is None:
                return NeighborResponse(nodes=[], edges=[])

            # Traverse jpath like /A/B/0
            cur = data
            if jpath and jpath != "/":
                parts = [p for p in jpath.split('/') if p != '']
                try:
                    for p in parts:
                        if isinstance(cur, list):
                            idx = int(p)
                            cur = cur[idx]
                        elif isinstance(cur, dict):
                            cur = cur.get(p)
                        else:
                            cur = None
                            break
                except Exception:
                    cur = None
            nodes: List[Dict[str, Any]] = []
            edges: List[Dict[str, Any]] = []

            parent_id = node_id
            def add_node(nid: str, label: str):
                nodes.append({"id": nid, "label": label})
            def add_edge(src: str, tgt: str, label: str = ""):
                edges.append({"id": _edge_id(src, tgt, label), "source": src, "target": tgt, "label": label})

            if isinstance(cur, dict):
                for k, v in list(cur.items())[:200]:
                    child_path = jpath.rstrip('/') + '/' + k if jpath != '/' else '/' + k
                    label = k
                    # For readability, append a hint type
                    t = 'obj' if isinstance(v, dict) else ('arr' if isinstance(v, list) else 'val')
                    disp = f"{label} [{t}]"
                    nid = f"json:{loan_id}:{child_path}"
                    add_node(nid, disp)
                    add_edge(parent_id, nid)
            elif isinstance(cur, list):
                for i, v in enumerate(cur[:200]):
                    child_path = jpath.rstrip('/') + f'/{i}' if jpath != '/' else f'/{i}'
                    t = 'obj' if isinstance(v, dict) else ('arr' if isinstance(v, list) else 'val')
                    disp = f"[{i}] [{t}]"
                    nid = f"json:{loan_id}:{child_path}"
                    add_node(nid, disp)
                    add_edge(parent_id, nid)
            # primitives: no children
            return NeighborResponse(nodes=nodes, edges=edges)

        # Default typed prefixes
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
                logger.info(f"Graph neighbors: loan not found for id={raw_id}; returning empty neighbors")
                return NeighborResponse(nodes=[], edges=[])
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
            # Dynamic ULDD expansions for known prefixes
            # Expect formats: deal:<loanId> | collaterals:<loanId> | collateral:<loanId>:<i>
            # loans:<loanId> | deal_loan:<loanId>:<i> | parties:<loanId> | party:<loanId>:<i>
            try:
                if prefix in {"deal", "collaterals", "collateral", "loans", "deal_loan", "parties", "party"}:
                    # parse loan id and optional indices
                    parts = raw_id.split(":")
                    loan_id = parts[0]
                    raw = lds.tinydb.get_loan_data(loan_id)
                    if not raw:
                        logger.info(f"Graph neighbors: loan not found for id={loan_id} (prefix={prefix}); returning empty neighbors")
                        return NeighborResponse(nodes=[], edges=[])
                    data = raw.get('loan_data', raw)
                    deal = data.get('DEAL') if isinstance(data, dict) else None

                    def add_simple(id_, label, parent, edge_label=""):
                        add_node(id_, label)
                        add_edge(parent, id_, edge_label)

                    if prefix == "deal":
                        deal_id = f"deal:{loan_id}"
                        add_simple(deal_id, "DEAL", f"loan:{loan_id}")
                        add_simple(f"collaterals:{loan_id}", "COLLATERALS", deal_id)
                        add_simple(f"loans:{loan_id}", "LOANS", deal_id)
                        add_simple(f"parties:{loan_id}", "PARTIES", deal_id)

                    elif prefix == "collaterals" and isinstance(deal, dict) and isinstance(deal.get('COLLATERALS'), dict):
                        coll = deal['COLLATERALS'].get('COLLATERAL')
                        if coll is not None:
                            coll_list = coll if isinstance(coll, list) else [coll]
                            parent_id = f"collaterals:{loan_id}"
                            for i, _ in enumerate(coll_list):
                                add_simple(f"collateral:{loan_id}:{i}", f"COLLATERAL {i+1}", parent_id)

                    elif prefix == "collateral" and len(parts) >= 2 and isinstance(deal, dict):
                        try:
                            idx = int(parts[1])
                        except Exception:
                            idx = 0
                        coll = deal.get('COLLATERALS', {}).get('COLLATERAL')
                        if coll is not None:
                            coll_list = coll if isinstance(coll, list) else [coll]
                            if 0 <= idx < len(coll_list):
                                c = coll_list[idx]
                                props = c.get('PROPERTIES') if isinstance(c, dict) else None
                                if isinstance(props, dict):
                                    pr = props.get('PROPERTY')
                                    pr_list = pr if isinstance(pr, list) else ([pr] if pr is not None else [])
                                    parent_id = f"collateral:{loan_id}:{idx}"
                                    for j, prop in enumerate(pr_list):
                                        label = f"PROPERTY {j+1}"
                                        if isinstance(prop, dict) and isinstance(prop.get('ADDRESS'), dict):
                                            addr = prop['ADDRESS']
                                            street = addr.get('AddressLineText') or addr.get('StreetAddress') or addr.get('AddressLine1Text')
                                            city = addr.get('CityName') or addr.get('City')
                                            state = addr.get('StateCode') or addr.get('StateName') or addr.get('State')
                                            postal = addr.get('PostalCode') or addr.get('ZipCode')
                                            parts2 = [p for p in [street, city, state, postal] if p]
                                            if parts2:
                                                label = " ".join(parts2)
                                        add_simple(f"property:{loan_id}:{idx}:{j}", label, parent_id, "PROPERTY")

                    elif prefix == "loans" and isinstance(deal, dict) and isinstance(deal.get('LOANS'), dict):
                        loan_items = deal['LOANS'].get('LOAN')
                        loan_list = loan_items if isinstance(loan_items, list) else ([loan_items] if loan_items is not None else [])
                        parent_id = f"loans:{loan_id}"
                        for i, lo in enumerate(loan_list):
                            role = lo.get('@LoanRoleType') if isinstance(lo, dict) else ""
                            title = f"LOAN {i+1}{f' ({role})' if role else ''}"
                            add_simple(f"deal_loan:{loan_id}:{i}", title, parent_id)

                    elif prefix == "deal_loan" and len(parts) >= 2 and isinstance(deal, dict) and isinstance(deal.get('LOANS'), dict):
                        try:
                            idx = int(parts[1])
                        except Exception:
                            idx = 0
                        loan_items = deal['LOANS'].get('LOAN')
                        loan_list = loan_items if isinstance(loan_items, list) else ([loan_items] if loan_items is not None else [])
                        if 0 <= idx < len(loan_list):
                            lo = loan_list[idx]
                            parent_id = f"deal_loan:{loan_id}:{idx}"
                            def add_section(key, label):
                                if isinstance(lo, dict) and lo.get(key) is not None:
                                    add_simple(f"{key.lower()}:{loan_id}:{idx}", label, parent_id, key)
                            for key,label in [
                                ('LOAN_DETAIL','LOAN_DETAIL'),
                                ('PAYMENT','PAYMENT'),
                                ('ESCROW','ESCROW'),
                                ('LOAN_IDENTIFIERS','LOAN_IDENTIFIERS'),
                                ('MI_DATA','MI_DATA'),
                                ('SERVICING','SERVICING'),
                                ('INVESTOR_LOAN_INFORMATION','INVESTOR_LOAN_INFORMATION'),
                            ]:
                                add_section(key,label)

                    elif prefix == "parties" and isinstance(deal, dict) and isinstance(deal.get('PARTIES'), dict):
                        party_items = deal['PARTIES'].get('PARTY')
                        party_list = party_items if isinstance(party_items, list) else ([party_items] if party_items is not None else [])
                        parent_id = f"parties:{loan_id}"
                        for i, party in enumerate(party_list):
                            label = f"PARTY {i+1}"
                            if isinstance(party, dict):
                                indiv = party.get('INDIVIDUAL')
                                org = party.get('ORGANIZATION')
                                if isinstance(indiv, dict):
                                    name = indiv.get('NAME') or {}
                                    first = name.get('FirstName') or name.get('FirstNameText')
                                    last = name.get('LastName') or name.get('LastNameText')
                                    nm = " ".join([p for p in [first, last] if p])
                                    if nm:
                                        label = nm
                                elif isinstance(org, dict):
                                    on = org.get('Name') or org.get('OrganizationName')
                                    if on:
                                        label = on
                            add_simple(f"party:{loan_id}:{i}", label, parent_id, "PARTY")
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Dynamic expand failed: {e}")

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
