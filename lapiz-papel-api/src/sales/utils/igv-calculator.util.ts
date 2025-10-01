export interface IGVCalculation {
  subtotal: number;
  igv_amount: number;
  total_amount: number;
}

export class IGVCalculatorUtil {
  private static readonly DEFAULT_IGV_RATE = 0.18; // 18%

  /**
   * Calcula el IGV cuando el monto incluye IGV
   * Ejemplo: Total = 100, IGV = 18%
   * Subtotal = 100 / 1.18 = 84.75
   * IGV = 100 - 84.75 = 15.25
   */
  static calculateFromTotalWithIGV(
    totalWithIGV: number,
    igvRate: number = this.DEFAULT_IGV_RATE,
  ): IGVCalculation {
    const subtotal = totalWithIGV / (1 + igvRate);
    const igv_amount = totalWithIGV - subtotal;

    return {
      subtotal: Math.round(subtotal * 100) / 100, // Round to 2 decimals
      igv_amount: Math.round(igv_amount * 100) / 100,
      total_amount: totalWithIGV,
    };
  }

  /**
   * Calcula el IGV cuando el monto NO incluye IGV
   * Ejemplo: Subtotal = 100, IGV = 18%
   * IGV = 100 * 0.18 = 18
   * Total = 100 + 18 = 118
   */
  static calculateFromSubtotalWithoutIGV(
    subtotal: number,
    igvRate: number = this.DEFAULT_IGV_RATE,
  ): IGVCalculation {
    const igv_amount = subtotal * igvRate;
    const total_amount = subtotal + igv_amount;

    return {
      subtotal,
      igv_amount: Math.round(igv_amount * 100) / 100,
      total_amount: Math.round(total_amount * 100) / 100,
    };
  }

  /**
   * Auto-calcula el IGV basado en los parámetros de entrada
   */
  static autoCalculateIGV(
    amount: number,
    includesIGV: boolean,
    igvRate: number = this.DEFAULT_IGV_RATE,
  ): IGVCalculation {
    if (includesIGV) {
      return this.calculateFromTotalWithIGV(amount, igvRate);
    } else {
      return this.calculateFromSubtotalWithoutIGV(amount, igvRate);
    }
  }

  /**
   * Valida que los cálculos de IGV sean consistentes
   */
  static validateIGVCalculation(
    subtotal: number,
    igv_amount: number,
    total_amount: number,
    igvRate: number = this.DEFAULT_IGV_RATE,
  ): boolean {
    const expectedIGV = subtotal * igvRate;
    const expectedTotal = subtotal + expectedIGV;

    const igvDiff = Math.abs(igv_amount - expectedIGV);
    const totalDiff = Math.abs(total_amount - expectedTotal);

    // Allow small rounding differences (0.01)
    return igvDiff <= 0.01 && totalDiff <= 0.01;
  }

  /**
   * Formatea los montos para mostrar
   */
  static formatAmount(amount: number): string {
    return `S/ ${amount.toFixed(2)}`;
  }

  /**
   * Formatea la tasa de IGV para mostrar
   */
  static formatRate(rate: number): string {
    return `${(rate * 100).toFixed(0)}%`;
  }
}
