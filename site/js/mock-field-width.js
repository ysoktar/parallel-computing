// Width of one editable CUDA answer, in monospace character units.
// Long expressions expand; manual drag can make the textarea wider.
export function suggestedAnswerWidth(answer){
 const length=String(answer??"").length;
 return Math.max(22,Math.min(58,length+4));
}
