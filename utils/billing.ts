import { Organization, SmartScreenPricing, InvoiceDetails, InvoiceAdjustmentItem } from '../types';

export function calculateInvoiceDetails(
    org: Organization,
    pricing: SmartScreenPricing
): InvoiceDetails {
    // 1. Determine the billing period based on the last billed month.
    let lastBilledYear: number, lastBilledMonthIndex: number; // 0-indexed month

    if (org.lastBilledMonth) {
        [lastBilledYear, lastBilledMonthIndex] = org.lastBilledMonth.split('-').map(Number);
        lastBilledMonthIndex -= 1; // Convert to 0-indexed for Date object.
    } else {
        // If never billed, the "last billed month" is considered the month *before* the first studio was created.
        const firstStudioCreation = Math.min(...(org.studios.map(s => s.createdAt).filter(Boolean) as number[]), Date.now());
        const firstStudioDate = new Date(firstStudioCreation);
        const monthBeforeFirstStudio = new Date(firstStudioDate.getFullYear(), firstStudioDate.getMonth() - 1, 1);
        lastBilledYear = monthBeforeFirstStudio.getFullYear();
        lastBilledMonthIndex = monthBeforeFirstStudio.getMonth();
    }

    // The month we need to generate an invoice for is the one *after* the last billed month.
    const billingPeriodDate = new Date(lastBilledYear, lastBilledMonthIndex + 1, 1);
    const billingPeriod = billingPeriodDate.toLocaleString('sv-SE', { month: 'long', year: 'numeric' });
    const billingMonthForAction = `${billingPeriodDate.getFullYear()}-${String(billingPeriodDate.getMonth() + 1).padStart(2, '0')}`;

    // The adjustment period is the month *before* the current billing period.
    const adjustmentPeriodDate = new Date(billingPeriodDate.getFullYear(), billingPeriodDate.getMonth() - 1, 1);
    const adjustmentPeriod = adjustmentPeriodDate.toLocaleString('sv-SE', { month: 'long', year: 'numeric' });
    const daysInAdjustmentMonth = new Date(adjustmentPeriodDate.getFullYear(), adjustmentPeriodDate.getMonth() + 1, 0).getDate();

    // 2. Calculate Regular Cost for the upcoming billing period.
    // This is based on all studios that existed AT THE START of the billing period.
    const screensActiveForRegularBill = org.studios.filter(
        s => !s.createdAt || s.createdAt < billingPeriodDate.getTime()
    );
    const numActiveScreens = screensActiveForRegularBill.length;

    let regularCost = 0;
    const regularItems: InvoiceDetails['regularItems'] = [];
    if (numActiveScreens > 0) {
        regularCost += pricing.firstScreenPrice;
        regularItems.push({ description: 'Grundpris (inkl. 1 skyltfönster)', quantity: 1, price: pricing.firstScreenPrice, total: pricing.firstScreenPrice });
        
        if (numActiveScreens > 1) {
            const additionalScreens = numActiveScreens - 1;
            const additionalCost = additionalScreens * pricing.additionalScreenPrice;
            regularCost += additionalCost;
            regularItems.push({ description: 'Ytterligare skyltfönster', quantity: additionalScreens, price: pricing.additionalScreenPrice, total: additionalCost });
        }
    }

    // 3. Calculate Adjustments from the adjustment period (the previous month).
    const adjustmentItems: InvoiceAdjustmentItem[] = [];
    
    const adjustmentPeriodStart = adjustmentPeriodDate.getTime();
    const screensActiveBeforeAdjustmentPeriod = org.studios.filter(
        s => !s.createdAt || s.createdAt < adjustmentPeriodStart
    ).length;

    // Find and sort studios created *during* the adjustment period to apply pricing tiers correctly.
    const newStudiosInAdjustmentPeriod = org.studios
        .filter(s => {
            if (!s.createdAt) return false;
            const createdDate = new Date(s.createdAt);
            return createdDate.getFullYear() === adjustmentPeriodDate.getFullYear() &&
                   createdDate.getMonth() === adjustmentPeriodDate.getMonth();
        })
        .sort((a, b) => a.createdAt! - b.createdAt!);

    let currentScreenCount = screensActiveBeforeAdjustmentPeriod;

    for (const studio of newStudiosInAdjustmentPeriod) {
        const createdDate = new Date(studio.createdAt!);
        const dayOfMonthCreated = createdDate.getDate();
        
        // The first screen ever is base price, subsequent ones are additional price.
        // This is based on a running count for the month, starting from what existed before.
        const priceForThisScreen = (currentScreenCount < 1) ? pricing.firstScreenPrice : pricing.additionalScreenPrice;
        currentScreenCount++; // Increment for the next new studio in this month.
        
        const daysToBill = daysInAdjustmentMonth - dayOfMonthCreated + 1;
        const proRataAmount = (priceForThisScreen / daysInAdjustmentMonth) * daysToBill;
    
        adjustmentItems.push({
            description: `+ Tillagd skärm "${studio.name}" (${createdDate.toLocaleDateString('sv-SE')})`,
            amount: proRataAmount,
        });
    }

    const totalAdjustments = adjustmentItems.reduce((sum, item) => sum + item.amount, 0);
    const subtotal = regularCost + totalAdjustments;

    // 4. Calculate Discount and Total.
    const discountType = org.discountType || (org.discountPercentage ? 'percentage' : undefined);
    const discountValue = org.discountValue ?? org.discountPercentage ?? 0;
    
    let discountAmount = 0;
    let discountDescription = 'Ingen';
    if (discountType === 'percentage' && discountValue > 0) {
        discountAmount = subtotal * (discountValue / 100);
        discountDescription = `${discountValue}% på ${subtotal.toFixed(2)} kr`;
    } else if (discountType === 'fixed' && discountValue > 0) {
        discountAmount = discountValue;
        discountDescription = `Fast belopp`;
    }
    
    const totalAmount = subtotal - discountAmount;

    return {
        regularItems,
        adjustmentItems,
        subtotal,
        discountAmount,
        discountDescription,
        totalAmount: Math.max(0, totalAmount),
        billingPeriod,
        adjustmentPeriod,
        billingMonthForAction,
    };
}