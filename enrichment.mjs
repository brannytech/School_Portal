// Broader practice: each tuple stores a separately auditable operation and its inputs.
export function enrich(w,i){
 if(i%12<4)return null;
 const v=i%12-4,n=2+Math.floor(i/12),a=n+2,b=n+1;
 let prompt,answer,explanation,check;
 function set(p,r,e,k,args){prompt=p;answer=String(r);explanation=e;check={kind:k,args};}
 if(w===0){
  const base=[2,5,8][v%3],x=a*base+1,y=b;
  if(v===0||v===4)set(`Add ${x.toString(base)} and ${y.toString(base)} in base ${base}. Give your answer in base ${base}.`,(x+y).toString(base),`Their decimal values are ${x} and ${y}. Add to get ${x+y}, then divide repeatedly by ${base}: ${(x+y).toString(base)}. Carry whenever a column reaches ${base}.`,'base-add',[x,y,base]);
  if(v===1||v===5)set(`Subtract ${y.toString(base)} from ${x.toString(base)} in base ${base}. Give your answer in that base.`,(x-y).toString(base),`In decimal this is ${x} − ${y} = ${x-y}. Convert back to base ${base}: ${(x-y).toString(base)}. Borrow a group of ${base} when needed.`,'base-subtract',[x,y,base]);
  if(v===2||v===6)set(`Multiply ${a.toString(base)} by ${b.toString(base)} in base ${base}. Give your answer in that base.`,(a*b).toString(base),`Convert to decimal: ${a} × ${b} = ${a*b}. The product in base ${base} is ${(a*b).toString(base)}.`,'base-product',[a,b,base]);
  if(v===3)set(`Find the base k if 13 in base k has decimal value ${a+3}.`,a,`Expand: 1×k + 3 = ${a+3}. Subtract 3: k = ${a}. The digits 1 and 3 are valid since ${a} > 3.`,'find-base',[a+3]);
  if(v===7)set(`A phone stores the binary number ${(a*3).toString(2)}. Convert it to base eight.`,(a*3).toString(8),`First convert to decimal: ${a*3}. Divide by 8, reading remainders upwards: ${(a*3).toString(8)}.`,'cross-base',[a*3,8]);
 }
 if(w===1){
  if(v===0)set(`Evaluate ${a}^5 ÷ ${a}^3.`,a*a,`Subtract the powers: ${a}^(5−3) = ${a}² = ${a*a}.`,'index-divide',[a,5,3]);
  if(v===1)set(`Evaluate (${a}²)³.`,a**6,`Multiply the indices: 2×3 = 6, so the answer is ${a}^6 = ${a**6}.`,'power-power',[a,2,3]);
  if(v===2)set(`Evaluate ${a}⁰.`,1,'Any nonzero base to power zero equals 1.','zero',[a]);
  if(v===3)set(`Evaluate ${a}^(−2). Give a decimal answer to 4 decimal places.`,(1/(a*a)).toFixed(4),`A negative exponent gives a reciprocal: 1/${a}² = 1/${a*a} ≈ ${(1/(a*a)).toFixed(4)}.`,'negative-index',[a,2]);
  if(v===4)set(`Evaluate ${a**3}^(2/3).`,a*a,`Take the cube root first: ${a}. Then square: ${a}² = ${a*a}.`,'fractional-index',[a**3,3,2]);
  if(v===5)set(`Solve 2^(x+1) = ${2**(n+3)}. Find x.`,n+2,`The right side is 2^${n+3}. Equate indices: x+1 = ${n+3}, so x = ${n+2}.`,'index-equation',[2**(n+3)]);
  if(v===6)set(`Evaluate (${a} × ${b})².`,(a*b)**2,`Apply the power to each factor: ${a}² × ${b}² = ${a*a} × ${b*b} = ${(a*b)**2}.`,'product-power',[a,b]);
  if(v===7)set(`A data file doubles in size each day. It begins at ${a} MB. How many MB after 3 days?`,a*8,`Three doublings multiply the size by 2³ = 8. ${a} × 8 = ${a*8} MB.`,'doubling',[a,3]);
 }
 if(w===2){
  const values=[45.6,4560,.0456,23.5,4.62,.00625,125,7.25],value=values[v];
  if(v===2||v===5)set(`Find the characteristic of the common logarithm of ${value}. Use a signed integer.`,Math.floor(Math.log10(value)),`Write ${value} in standard form with a leading number between 1 and 10. The power of 10 is ${Math.floor(Math.log10(value))}; this is the characteristic. The mantissa remains positive.`,'characteristic',[value]);
  else if(v===3||v===7){const mantissa=Number(Math.log10(value).toFixed(4));set(`Find antilog₁₀(${mantissa}). Round to 3 decimal places.`,(10**mantissa).toFixed(3),`Raise 10 to the signed logarithm: 10^${mantissa} ≈ ${(10**mantissa).toFixed(3)}. Check the decimal position.`,'antilog',[mantissa,3]);}
  else set(`Find log₁₀(${value}) to 4 decimal places. Use ordinary signed notation.`,Math.log10(value).toFixed(4),`Characteristic: ${Math.floor(Math.log10(value))}. Mantissa: ${(Math.log10(value)-Math.floor(Math.log10(value))).toFixed(4)}. Add the signed characteristic to the positive mantissa: ${Math.log10(value).toFixed(4)}.`,'log',[value,4]);
 }
 if(w===3){
  if(v<4){const value=[45.6,.0625,125,.008][v],power=v<2?2:3;set(`Use logarithms to find the ${power===2?'square':'cube'} root of ${value}. Round to 3 decimal places.`,Math.pow(value,1/power).toFixed(3),`Take log₁₀(${value}) = ${Math.log10(value).toFixed(4)}. Divide the full signed logarithm by ${power}, then take antilog: ${Math.pow(value,1/power).toFixed(3)}.`,'root',[value,power,3]);}
  else {const exponent=v%2?3:2;set(`Using the power rule, evaluate ${a}^${exponent}.`,a**exponent,`Multiply log₁₀(${a}) by ${exponent} and take antilog. Check by multiplication: ${a**exponent}.`,'integer-power',[a,exponent]);}
 }
 if(w===4){
  if(v===0||v===4)set(`A shop sells ${a} notebooks at ₦${b*100} each. Find the total cost in naira.`,a*b*100,`Quantity × price: ${a} × ${b*100} = ₦${a*b*100}. Add the logs of the positive factors and take antilog to check.`,'money-product',[a,b*100]);
  if(v===1||v===5)set(`Use log rules to evaluate (${a} × ${b}) / 2.`,a*b/2,`Add log ${a} and log ${b}, subtract log 2, then take antilog. Direct check: ${a*b}/2 = ${a*b/2}.`,'combined-log',[a,b,2]);
  if(v===2||v===6){const principal=10000,rate=5,years=n;set(`₦${principal} grows at ${rate}% compound interest per year for ${years} years. Find the amount, to 2 decimal places.`,(principal*1.05**years).toFixed(2),`A = P(1+r/100)^years = 10000×1.05^${years} = ₦${(principal*1.05**years).toFixed(2)}.`,'compound',[principal,rate,years]);}
  if(v===3||v===7)set(`A logarithmic scale rises from log₁₀(10) to log₁₀(1000). What is the multiplicative factor in the original quantities?`,100,'The logarithm rises by 2. The original quantity changes by 10² = 100.','scale-factor',[10,1000]);
 }
 if(w===5){
  if(v===0)set(`Solve 2(x + ${n}) = ${2*(a+n)}. Find x.`,a,`Divide both sides by 2, then subtract ${n}: x = ${a}. Substitute into the original equation to check.`,'bracket-equation',[n,2*(a+n)]);
  if(v===1)set(`y varies inversely as x. y = ${a*2} when x = 3. Find y when x = 6.`,a,`xy is constant: k = ${a*2}×3 = ${a*6}. Then y = ${a*6}/6 = ${a}.`,'inverse',[a*2,3,6]);
  if(v===2)set(`y = kxz. y = ${a*6} when x = 2 and z = 3. Find k.`,a,`Substitute the known values: ${a*6} = k×2×3. Divide by 6: k = ${a}.`,'joint',[a*6,2,3]);
  if(v===3)set(`A taxi fare is C = 700 + 300d. Find the cost in naira for ${a} km.`,700+300*a,`The fixed charge is ₦700. Add ₦300 × ${a}: ₦${700+300*a}.`,'partial',[700,300,a]);
  if(v===4)set(`Solve x/${a} + 2 = ${b+2}. Find x.`,a*b,`Subtract 2: x/${a} = ${b}. Multiply by ${a}: x = ${a*b}.`,'fraction-equation',[a,b+2]);
  if(v===5)set(`${a} equally efficient workers finish a job in ${b*2} days. How many days would ${a*2} workers take?`,b,`For fixed work, workers × days is constant. Doubling workers halves ${b*2} days to ${b}.`,'workers',[a,b*2,a*2]);
  if(v===6)set(`y varies directly as x. y = ${a*3} at x = 3. Find x when y = ${a*b}.`,b,`The constant k is ${a*3}/3 = ${a}. Now ${a*b} = ${a}x, so x = ${b}.`,'direct-x',[a*3,3,a*b]);
  if(v===7)set(`Solve 3x − ${n} = 2x + ${a}. Find x.`,a+n,`Subtract 2x from both sides, then add ${n}: x = ${a+n}.`,'two-sides',[n,a]);
 }
 if(w===6){
  if(v===0)set(`From P = 2(l + w), find l when P = ${2*(a+b)} and w = ${b}.`,a,`Divide by 2 and subtract w: l = P/2 − w = ${a+b} − ${b} = ${a}.`,'perimeter',[2*(a+b),b]);
  if(v===1)set(`From A = πr², find the nonnegative radius when A = ${a*a}π.`,a,`Divide by π, then take the nonnegative square root: r = √${a*a} = ${a}.`,'radius',[a*a]);
  if(v===2)set(`From F = 9C/5 + 32, find C when F = ${9*a+32}.`,a*5,`Subtract 32 and multiply by 5/9: C = (${9*a+32}−32)×5/9 = ${a*5}.`,'temperature',[9*a+32]);
  if(v===3)set(`From I = PRT/100, find R when I = ${a*100}, P = 10000 and T = 2.`,a/2,`R = 100I/(PT) = ${a*10000}/20000 = ${a/2}.`,'interest-rate',[a*100,10000,2]);
  if(v===4)set(`From S = (a + l)n/2, find l when S = ${(a+b)*3}, a = ${a}, n = 6.`,b,`l = 2S/n − a = ${a+b} − ${a} = ${b}.`,'last-term',[(a+b)*3,a,6]);
  if(v===5)set(`From y = kx + x, find x when y = ${a*(b+1)} and k = ${b}.`,a,`Factor x: y = x(k+1). Divide by k+1: x = ${a*(b+1)}/${b+1} = ${a}.`,'factor-subject',[a*(b+1),b]);
  if(v===6)set(`From v = d/t, find t when d = ${a*b} and v = ${b}.`,a,`Multiply by t, then divide by v: t = d/v = ${a*b}/${b} = ${a}.`,'travel-time',[a*b,b]);
  if(v===7)set(`From E = mv²/2, find the nonnegative v when E = ${a*a} and m = 2.`,a,`v = √(2E/m) = √(${2*a*a}/2) = √${a*a} = ${a}.`,'energy',[a*a,2]);
 }
 if(w===7){
  if(v===0)set(`Solve x² − ${a+b}x + ${a*b} = 0. Give the smaller root.`,b,`Factor: (x−${a})(x−${b}) = 0. The roots are ${a} and ${b}; the smaller is ${b}.`,'smaller-root',[a+b,a*b]);
  if(v===1)set(`Find the discriminant of x² − ${a+b}x + ${a*b} = 0.`,(a+b)**2-4*a*b,`Use b²−4ac: (${-(a+b)})²−4×1×${a*b} = ${(a+b)**2-4*a*b}.`,'discriminant',[1,-a-b,a*b]);
  if(v===2)set(`Find the x-coordinate of the vertex of y = x² − ${2*a}x + ${b}.`,a,`The axis is x = −b/(2a). For these coefficients, x = ${2*a}/2 = ${a}.`,'vertex-x',[1,-2*a,b]);
  if(v===3)set(`Complete the square: x² + ${2*a}x = (x + ${a})² − k. Find k.`,a*a,`Expanding (x+${a})² gives x²+${2*a}x+${a*a}. Subtract ${a*a} to recover the original expression.`,'complete-square',[a]);
  if(v===4)set(`A monic quadratic has roots ${a} and ${b}. What is its constant term?`,a*b,`Expand (x−${a})(x−${b}). The constant is the product of the roots: ${a*b}.`,'root-product',[a,b]);
  if(v===5)set(`How many distinct real roots does x² + ${a*a} = 0 have?`,0,`The discriminant is 0−4×1×${a*a}, which is negative. There are no real roots.`,'root-count',[1,0,a*a]);
  if(v===6)set(`For y = x² − 2x − 3, find the y-coordinate of the turning point.`,-4,'The axis is x=1. Substitute: y=1−2−3=−4.','vertex-y',[1,-2,-3]);
  if(v===7)set(`Solve x² − ${a*a} = 0. Give the positive root.`,a,`This is a difference of squares: (x−${a})(x+${a})=0. The positive root is ${a}.`,'positive-root',[a*a]);
 }
 return {prompt,answer,explanation,check};
}
