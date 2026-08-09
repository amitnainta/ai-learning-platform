import { describe, expect, it } from "vitest";
import { EMPTY_AGGREGATE, formatAggregate, roundAverage } from "../aggregate";

describe("roundAverage", () => {
  it("rounds 4.25 to 4.3", () => {
    expect(roundAverage(4.25)).toBe(4.3);
  });

  it("rounds 4.0 to 4", () => {
    expect(roundAverage(4.0)).toBe(4);
  });

  it("rounds 4.44 to 4.4", () => {
    expect(roundAverage(4.44)).toBe(4.4);
  });

  it("rounds 4.46 to 4.5", () => {
    expect(roundAverage(4.46)).toBe(4.5);
  });
});

describe("formatAggregate", () => {
  it('a null average with count 0 formats as "Not yet rated"', () => {
    const result = formatAggregate(EMPTY_AGGREGATE);
    expect(result.text).toBe("Not yet rated");
    expect(result.ariaText).toBe("Not yet rated");
  });

  it('count 1 pluralizes as "1 rating"', () => {
    const result = formatAggregate({ average: 5, count: 1 });
    expect(result.text).toBe("5 out of 5 - 1 rating");
  });

  it('count > 1 pluralizes as "N ratings"', () => {
    const result = formatAggregate({ average: 4.25, count: 12 });
    expect(result.text).toBe("4.3 out of 5 - 12 ratings");
  });

  it("the ariaText names the average and the count", () => {
    const result = formatAggregate({ average: 4.25, count: 12 });
    expect(result.ariaText).toBe("Average rating 4.3 out of 5, from 12 ratings");
  });
});
