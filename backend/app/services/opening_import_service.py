import pandas as pd
from typing import Dict, Any, List, Tuple
import uuid
import math
from sqlalchemy.future import select

from app.db.session import AsyncSessionLocal
from app.models.product import Product, ProductCategory, ProductStatus
from app.models.stock_movement import StockMovement, MovementType
from app.services.inventory_service import invalidate_inventory_cache

REQUIRED_COLUMNS = [
    "Product Name", "Category", "Size (ml)", "MRP", "Purchase Price", "SCM Code", "Opening Quantity"
]

def _parse_file(file_path: str) -> pd.DataFrame:
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)
    return df

def validate_file(file_path: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Returns (valid_rows, errors)
    """
    try:
        df = _parse_file(file_path)
    except Exception as e:
        return [], [{"row": 0, "error": f"Failed to parse file: {str(e)}"}]
    
    # Check headers
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_cols:
        return [], [{"row": 0, "error": f"Missing required columns: {', '.join(missing_cols)}"}]

    # Drop fully blank rows (e.g. trailing formatted-but-empty rows in the sheet)
    df = df.dropna(how="all")

    valid_rows = []
    errors = []
    
    for index, row in df.iterrows():
        row_num = index + 2  # Excel row number (1-indexed + header)
        try:
            name = str(row["Product Name"]).strip()
            category = str(row["Category"]).strip().upper()
            size = float(row["Size (ml)"])
            mrp = float(row["MRP"])
            purchase_price = float(row["Purchase Price"])
            
            scm_code_raw = str(row["SCM Code"]).strip()
            scm_code_parts = [c.strip() for c in scm_code_raw.split(',') if c.strip()]
            scm_code = scm_code_parts[0] if scm_code_parts else ""
            additional_scm_codes = scm_code_parts[1:] if len(scm_code_parts) > 1 else []
            
            qty = int(row["Opening Quantity"])
            case_size = int(row["Case Size"]) if "Case Size" in df.columns and not pd.isna(row["Case Size"]) else None
            
            if not name or name == 'nan':
                errors.append({"row": row_num, "error": "Product Name cannot be empty"})
                continue
            if category not in [c.value for c in ProductCategory]:
                errors.append({"row": row_num, "error": f"Invalid Category: {category}"})
                continue
            if math.isnan(size) or size <= 0:
                errors.append({"row": row_num, "error": "Size must be > 0"})
                continue
            if math.isnan(mrp) or mrp <= 0:
                errors.append({"row": row_num, "error": "MRP must be > 0"})
                continue
            if math.isnan(purchase_price) or purchase_price < 0:
                errors.append({"row": row_num, "error": "Purchase Price cannot be negative"})
                continue
            if not scm_code or scm_code == 'nan':
                errors.append({"row": row_num, "error": "SCM Code cannot be empty"})
                continue
            if qty < 0:
                errors.append({"row": row_num, "error": "Opening Quantity cannot be negative"})
                continue
                
            valid_rows.append({
                "name": name,
                "category": category,
                "size_ml": int(size),
                "mrp": mrp,
                "purchase_price": purchase_price,
                "scm_code": scm_code,
                "additional_scm_codes": additional_scm_codes,
                "quantity": qty,
                "case_size": case_size
            })
        except Exception as e:
            errors.append({"row": row_num, "error": f"Row format error: {str(e)}"})
            
    return valid_rows, errors

def preview(file_path: str) -> List[Dict[str, Any]]:
    df = _parse_file(file_path)
    # Drop fully blank rows (e.g. trailing formatted-but-empty rows in the sheet)
    df = df.dropna(how="all")
    # Return first 10 rows safely
    df = df.head(10).fillna("")
    return df.to_dict('records')

async def process(file_path: str, business_id: uuid.UUID, user_id: uuid.UUID) -> Dict[str, Any]:
    valid_rows, errors = validate_file(file_path)
    if not valid_rows and errors:
        return {"products_created": 0, "products_updated": 0, "movements_created": 0, "errors": errors}
        
    products_created = 0
    products_updated = 0
    movements_created = 0

    async with AsyncSessionLocal() as db:
        for row in valid_rows:
            # 1. Try to find product by name and size
            stmt = select(Product).where(
                Product.business_id == business_id,
                Product.name == row["name"],
                Product.size_ml == row["size_ml"]
            )
            result = await db.execute(stmt)
            product = result.scalars().first()
            
            if not product:
                # Create product
                product = Product(
                    business_id=business_id,
                    name=row["name"],
                    category=ProductCategory(row["category"]),
                    size_ml=row["size_ml"],
                    mrp=row["mrp"],
                    purchase_price=row["purchase_price"],
                    scm_code=row["scm_code"],
                    additional_scm_codes=row["additional_scm_codes"],
                    case_size=row["case_size"],
                    status=ProductStatus.ACTIVE
                )
                db.add(product)
                await db.flush() # get ID
                products_created += 1
            else:
                # Update MRP/SCM code? Let's just use existing for now.
                # If they imported a new additional SCM code, we should append it
                new_additional = set(product.additional_scm_codes) | set(row["additional_scm_codes"])
                if new_additional != set(product.additional_scm_codes):
                    product.additional_scm_codes = list(new_additional)
                products_updated += 1
                
            # 2. Add Opening Stock Movement
            if row["quantity"] > 0:
                movement = StockMovement(
                    business_id=business_id,
                    product_id=product.id,
                    movement_type=MovementType.OPENING,
                    quantity=row["quantity"],
                    created_by=user_id,
                    notes="Opening inventory import"
                )
                db.add(movement)
                movements_created += 1
                
                # Invalidate cache manually since we aren't using MovementService here for bulk
                await invalidate_inventory_cache(business_id, product.id)
                    
        await db.commit()
        
    return {
        "products_created": products_created,
        "products_updated": products_updated,
        "movements_created": movements_created,
        "errors": errors
    }
