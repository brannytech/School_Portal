// Small HTML helpers shared by the Lesson Studio panels.
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const button=(action,label,extra='')=>`<button type="button" data-studio="${action}" ${extra}>${label}</button>`;
export const input=(label,path,value='',type='text',extra='')=>`<label>${label}<input data-path="${path}" type="${type}" value="${esc(value)}" ${extra}></label>`;
export const area=(label,path,value='',extra='')=>`<label>${label}<textarea data-path="${path}" ${extra}>${esc(value)}</textarea></label>`;
export const select=(label,path,options,current)=>`<label>${label}<select data-path="${path}">${options.map(([value,text])=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
export const check=(label,path,checked)=>`<label class="st-check"><input type="checkbox" data-path="${path}" ${checked?'checked':''}> <span>${label}</span></label>`;
