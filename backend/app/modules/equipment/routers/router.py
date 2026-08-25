from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.equipment.schemas import (
    EquipmentCategoryCreateRequest,
    EquipmentCategoryResponse,
    EquipmentProductCreateRequest,
    EquipmentProductResponse,
    EquipmentRequestCreateRequest,
    EquipmentRequestResponse,
    ProductMediaCreateRequest,
    ProductMediaResponse,
    SupplierCreateRequest,
    SupplierResponse,
)
from app.modules.equipment.services.equipment_service import EquipmentService

router = APIRouter(prefix="/api/v1/equipment", tags=["equipment"])


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(payload: SupplierCreateRequest, session: AsyncSession = Depends(get_db)) -> SupplierResponse:
    supplier = await EquipmentService.create_supplier(
        session,
        name=payload.name,
        description=payload.description,
        website=payload.website,
        email=payload.email,
        phone=payload.phone,
        city=payload.city,
        country=payload.country,
    )
    await session.commit()
    return SupplierResponse(
        id=str(supplier.id),
        name=supplier.name,
        description=supplier.description,
        website=supplier.website,
        email=supplier.email,
        phone=supplier.phone,
        city=supplier.city,
        country=supplier.country,
    )


@router.post("/categories", response_model=EquipmentCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(payload: EquipmentCategoryCreateRequest, session: AsyncSession = Depends(get_db)) -> EquipmentCategoryResponse:
    category = await EquipmentService.create_category(
        session,
        name=payload.name,
        description=payload.description,
        parent_id=payload.parent_id,
    )
    await session.commit()
    return EquipmentCategoryResponse(
        id=str(category.id),
        name=category.name,
        description=category.description,
        parent_id=str(category.parent_id) if category.parent_id else None,
    )


@router.post("/products", response_model=EquipmentProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(payload: EquipmentProductCreateRequest, session: AsyncSession = Depends(get_db)) -> EquipmentProductResponse:
    product = await EquipmentService.create_product(
        session,
        category_id=payload.category_id,
        supplier_id=payload.supplier_id,
        name=payload.name,
        description=payload.description,
        manufacturer=payload.manufacturer,
        price=payload.price,
        currency=payload.currency,
        status=payload.status,
    )
    await session.commit()
    return EquipmentProductResponse(
        id=str(product.id),
        category_id=str(product.category_id),
        supplier_id=str(product.supplier_id) if product.supplier_id else None,
        name=product.name,
        description=product.description,
        manufacturer=product.manufacturer,
        price=float(product.price),
        currency=product.currency,
        status=product.status,
    )


@router.post("/products/media", response_model=ProductMediaResponse, status_code=status.HTTP_201_CREATED)
async def create_product_media(payload: ProductMediaCreateRequest, session: AsyncSession = Depends(get_db)) -> ProductMediaResponse:
    media = await EquipmentService.create_product_media(
        session,
        product_id=payload.product_id,
        media_file_id=payload.media_file_id,
        order_number=payload.order_number,
    )
    await session.commit()
    return ProductMediaResponse(
        id=str(media.id),
        product_id=str(media.product_id),
        media_file_id=str(media.media_file_id),
        order_number=media.order_number,
    )


@router.post("/requests", response_model=EquipmentRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(payload: EquipmentRequestCreateRequest, session: AsyncSession = Depends(get_db)) -> EquipmentRequestResponse:
    request = await EquipmentService.create_request(
        session,
        user_id=payload.user_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        comment=payload.comment,
        status=payload.status,
    )
    await session.commit()
    return EquipmentRequestResponse(
        id=str(request.id),
        user_id=str(request.user_id),
        product_id=str(request.product_id),
        quantity=request.quantity,
        comment=request.comment,
        status=request.status,
    )
