// #ifdef APP-VUE|| MP-WEIXIN || H5
export default {
	data() {
		return {
			isShow: false,
			isDisabled: false,
			thresholdVal: 30
		}
	},
	watch: {
		show(newVal) {
			this.isShow = this.show ? 'right' : 'none'
		},
		disabled(val) {
			this.isDisabled = this.disabled
		},
		threshold(val) {
			this.thresholdVal = Number(this.threshold)
		}
	},
	created() {
		this.group = this.getParent()
		if (this.group.children !== undefined) {
			this.group.children.push(this)
		}
	},
	mounted() {
		this.$nextTick(() => {
			setTimeout(() => {
				this.isShow = this.show ? 'right' : 'none'
				this.isDisabled = this.disabled
				this.thresholdVal = Number(this.threshold)
			}, 10)
		})
	},
	methods: {
		closeSwipe(e) {
			if (!this.autoClose) return
			this.group && this.group.closeAuto(this)
		},
		change(e) {
			const isOpen = e.open === 'right'
			this.$emit('change', {
				isOpen: isOpen,
				param: this.param
			})
			if (this.isShow !== e.open) {
				this.isShow = e.open
			}
		},
		/**
		 * 是否 PC 浏览器（H5 专用）：靠 UA 里有没有**移动端标记**来判断。
		 *
		 * ⚠️ 鸿蒙必须算移动端：
		 *   · HarmonyOS 4 及更早的 UA 里带 "Android" → 本来就能命中；
		 *   · **HarmonyOS NEXT**（OpenHarmony / ArkWeb）的 UA 既没有 "Android" 也没有 "iPhone"，
		 *     漏掉就会被判成 PC → `appTouchStart/appTouchEnd` 直接 return、`handleClick` 反而接管，
		 *     鸿蒙手机上滑动手势 / 点击都会错乱。
		 * 顺手修两个老 bug：原来 `v < Agents.length - 1` 漏掉最后一个标记、
		 * `indexOf(...) > 0` 也漏掉「标记正好在 UA 开头」的情况。
		 */
		isPC() {
			if (typeof navigator !== 'object' || !navigator) return false
			var userAgentInfo = String(navigator.userAgent || '');
			var Agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod", "HarmonyOS", "OpenHarmony", "ArkWeb"];
			for (let v = 0; v < Agents.length; v++) {
				if (userAgentInfo.indexOf(Agents[v]) >= 0) {
					return false;
				}
			}
			return true;
		},
		//解决 ios 13 点击区域错位的问题
		appTouchStart(e) {
			// #ifdef H5
			if (this.isPC()) return
			// #endif
			const {
				clientX
			} = e.changedTouches[0]
			this.clientX = clientX
			this.timestamp = new Date().getTime()
		},
		appTouchEnd(e, index, item) {
			// #ifdef H5
			if (this.isPC()) return
			// #endif
			const {
				clientX
			} = e.changedTouches[0]
			let diff = Math.abs(this.clientX - clientX)
			let time = (new Date().getTime()) - this.timestamp
			if (diff < 40 && time < 300) {
				this.$emit('click', {
					index,
					item,
					param: this.param
				})
			}
		},
		handleClick(index, item) {
			// #ifdef H5
			if (!this.isPC()) return
			this.$emit('click', {
				index,
				item,
				param: this.param
			})
			// #endif
		}
	}
}

// #endif
// #ifndef APP-VUE|| MP-WEIXIN || H5
export default {}
// #endif