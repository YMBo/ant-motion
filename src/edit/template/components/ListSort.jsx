import React,{Component} from 'react'
import ReactDOM from 'react-dom';
import QueueAnim from 'rc-queue-anim';
import TweenOne from 'rc-tween-one';
import PropTypes from 'prop-types';

/*将传进来的组件存入ret数组，并暴露出来*/
function toArrayChildren(children) {
	const ret = [];
	React.Children.forEach(children, (c) => {
		ret.push(c);
	});
	return ret;
}

/*返回匹配的子组件（一个）*/
/*
this.props.children 的值有三种可能：
如果当前组件没有子节点，它就是 undefined ;
如果有一个子节点，数据类型是 object ；
如果有多个子节点，数据类型就是 array
*/
function findChildInChildrenByKey(children, key) {
	let ret = null;
	/*如果子组件存在*/
	if (children) {
		children.forEach((c) => {
		/*每次循环都要判断ret是否有值，如果没有值且子组件为undefined就跳过当前循环*/
			if (ret || !c) {
				return;
			}
			/*如果子组件的key与当前key值相等，则将此子组件赋值给ret*/
			if (c.key === key) {
				ret = c;
			}
		});
	}
	return ret;
}

/*
两个参数(都是数组表示所有的子组件)：当前子组件，要更新的子组件
传进来的子元素（React.children）按照当前子元素顺序进行排序，如果多出来的push到数组的后面
*/
function mergeChildren(prev, next) {
	const ret = [];
// 保存更改后的顺序，新增的在新增时的位置插入。
	prev.forEach((c) => {
		if (!c) {
			return;
		}
		/*将next组件按照当前prev组件顺序排序*/
		const newChild = findChildInChildrenByKey(next, c.key);
		if (newChild) {
			ret.push(newChild);
		}
	});
	/*
	原因：如果要更新的next比prev个数多，那么将多的这些依次添加到末尾
	*/
	next.forEach((c, i) => {
		if (!c) {
			return;
		}
		const newChild = findChildInChildrenByKey(prev, c.key);
		if (!newChild) {
			ret.splice(i, 0, c);
		}
	});
	return ret;
}

export default class ListSort extends React.Component {
	/*必须要传的参数*/
	static propTypes = {
		component: PropTypes.any,
		children: PropTypes.any,
		animType: PropTypes.string,
		onChange: PropTypes.any,
		dragClassName: PropTypes.string,
		appearAnim: PropTypes.object,
		onEventChange: PropTypes.any,
	};
	/*设置默认的props参数*/
	/*下面这些参数如果上面不传，则使用这些默认参数*/
	static defaultProps = {
		component: 'div',
		/*竖向*/
		animType: 'y',
		/*返回更改后的位置信息*/
		onChange: () => {
		},
		/*回调*/
		onEventChange: () => {
		},
	};

	/*如果构造函数内要用到props则传递*/
	constructor(props) {
		console.log(props)
		super(props);
		this.state = {
			/*子内容*/
			children: this.props.children,
			/**/
			style: {},
			/*子元素内容*/
			childStyle: [],
			/*动画*/
			animation: [],
		};
		/*当前点击的元素位置*/
		this.index = null;
		this.swapIndex = null;
		/*初始化当前元素的位置信息*/
		this.mouseXY = null;
		/*每一个元素的初始样式*/
		this.childStyle = [];
		this.children = [];
		/*表示是否开始移动*/
		this.isDrage = false;
	}
	/*组件第一次渲染完,绑定事件*/
	componentDidMount() {
		/*这块要注意了，绑定的是window*/
		/*返回当前组件表示的dom元素*/
		this.dom = ReactDOM.findDOMNode(this);
		/*做兼容*/
		if (window.addEventListener) {
			window.addEventListener('mousemove', this.onMouseMove);
			window.addEventListener('touchmove', this.onMouseMove);
			window.addEventListener('mouseup', this.onMouseUp);
			window.addEventListener('touchend', this.onMouseUp);
		} else {
			window.attachEvent('onmousemove', this.onMouseMove);
			window.attachEvent('ontouchmove', this.onMouseMove);
			window.attachEvent('onmouseup', this.onMouseUp);
			window.attachEvent('ontouchend', this.onMouseUp);
		}
	}

	/*写这一段的原因*/
	/*组件接收到一个新的prop时被调用，为的是应对吧React.children有更新*/
	componentWillReceiveProps(nextProps) {
		/*当前组件*/
		const currentChildren = this.state.children;
		/*新组件*/
		const nextChildren = nextProps.children;
		/*新组件*/
		const newChildren = mergeChildren(currentChildren, nextChildren);
		this.setState({ children: newChildren });
	}

	/*解绑*/
	componentWillUnmount() {
		if (window.addEventListener) {
			window.removeEventListener('mousemove', this.onMouseMove);
			window.removeEventListener('touchmove', this.onMouseMove);
			window.removeEventListener('mouseup', this.onMouseUp);
			window.removeEventListener('touchend', this.onMouseUp);
		} else {
			window.detachEvent('onmousemove', this.onMouseMove);
			window.detachEvent('ontouchmove', this.onMouseMove);
			window.detachEvent('onmouseup', this.onMouseUp);
			window.detachEvent('ontouchend', this.onMouseUp);
		}
	}

	/*鼠标按下*/
	/*状态初始化*/
	onMouseDown = (i, e) => {
		if (this.isDrage) {
			return;
		}
		/*获取位置信息*/
		const rect = this.dom.getBoundingClientRect();
		document.body.style.overflow = 'hidden';
		/*回调传参数，返回此时的鼠标状态*/
		this.props.onEventChange(e, 'down');
		/*鼠标按下，定义css信息*/
		const style = {
			height: `${rect.height}px`,
			userSelect: 'none',
			WebkitUserSelect: 'none',
			MozUserSelect: 'none',
			MsUserSelect: 'none',
		};
		/*选中当前组件的所有子节点*/
		/*类数组对象的转换*/
		this.children = Array.prototype.slice.call(this.dom.children);
		this.childStyle = [];

		const childStyle = this.children.map((item, ii) => {
			/*从第二个算*/
			const cItem = this.children[ii + 1];
			let marginHeight;
			let marginWidth;
			if (cItem) {
				/*获取每一个元素的margin-bottom
				竖排
				*/
				marginHeight = cItem.offsetTop - item.offsetTop - item.clientHeight;
				/*同理获得左边距，这种是横排的情况*/
				marginWidth = cItem.offsetLeft - item.offsetLeft - item.clientWidth;
			} else {
			/*如果是最后一个子元素*/
			/*parentHeight：组件高度--组件底内边距*/
			/*
			parentHeight：这个操作是排除当前组件的paddint-bottom
			*/
			/*
			marginHeight：最后一个子元素的margin-bottom	
			*/
				const parentHeight = item.parentNode.clientHeight -
				parseFloat(getComputedStyle(item.parentNode).getPropertyValue('padding-bottom'));
				const parentWidth = item.parentNode.clientWidth -
				parseFloat(getComputedStyle(item.parentNode).getPropertyValue('padding-right'));
				marginHeight = parentHeight - item.offsetTop - item.clientHeight;
				marginWidth = parentWidth - item.offsetLeft - item.clientWidth;
			}
			/*
			marginHeight其实就是每一个元素距离下一个元素的间距(可以理解为margin-bottm)，如果是最后一个则为距父元素（除了padding）的间距
			*/
			const d = {
				width: item.clientWidth,
				height: item.clientHeight,
				top: item.offsetTop,
				left: item.offsetLeft,
				margin: 'auto',
				marginHeight,
				marginWidth,
				position: 'absolute',
				/*给当前点的这个list，z-index:1*/
				zIndex: ii === i ? 1 : 0,
			};
			/*这块为什么要用...d不太清楚*/
			this.childStyle.push({...d});
			return d;
		});

		/*xx.map((xxx) => (xxxx))  =  xx.map((xxx) => { return xxxx; })*/
		const animation = this.children.map((item, ii) =>
			/*给点中的元素添加样式*/
			/*dragClassName表示当前点击的元素，如果不存在就默认样式，否则就用户设置的样式*/
			i === ii && (!this.props.dragClassName ?
			{ scale: 1.2, boxShadow: '0 10px 10px rgba(0,0,0,0.15)' } : null) || null);
		/*当前点击元素的位置*/
		this.index = i;
		/*存储的是激活元素的目标位置*/
		this.swapIndex = i;
		/*初始化当前元素的位置信息*/
		this.mouseXY = {
			startX: e.touches === undefined ? e.clientX : e.touches[0].clientX,
			startY: e.touches === undefined ? e.clientY : e.touches[0].clientY,
			top: childStyle[i].top,
			left: childStyle[i].left,
		};
		/*
		dragClassName：选中的样式
		如果父组件设置了
		*/
		if (this.props.dragClassName) {
			/*当前点击的DOM节点*/
			this.listDom = e.currentTarget;
			/*给当前的dom元素添加选种样式，这种添加class的方式优点：
			不知道当前点中元素的class，确保了dragClassName唯一性（replace）
			*/
			this.listDom.className = `${this.listDom.className
			.replace(this.props.dragClassName, '').trim()} ${this.props.dragClassName}`;
		}
		this.isDrage = true;
		this.setState({
			/*整个组件的样式*/
			style,
			/*每一个列表元素的样式*/
			childStyle,
			/*点击元素样式：结构是[null,null,{..style}]*/
			animation,
		});
	};

	onMouseUp = (e) => {
		/*如果没有鼠标位置信息，就不进行计算
		应对情况：我在元素外面按下鼠标后移动到当前元素上up，那么就会return
		*/
		if (!this.mouseXY) {
			return;
		}
		/*清空状态信息*/
		this.mouseXY = null;
		document.body.style.overflow = null;
		/*给回调传状态*/
		this.props.onEventChange(e, 'up');

		const animation = this.state.animation.map((item, i) => {
			/*如果是当前选中的dom元素，（除了当前的元素以外，别的值已经确定）*/
			if (this.index === i) {
				const animate = {};
				let height = 0;
				if (this.props.animType === 'y') {
					/*这块完全没有必要这么写啊？直接animate.top = this.childStyle[this.swapIndex].top就可以了啊？*/
					if (this.swapIndex > this.index) {
						const start = this.index + 1;
						const end = this.swapIndex + 1;
						this.childStyle.slice(start, end).forEach((_item) => {
							height += _item.height + _item.marginHeight;
						});
						animate.top = height + this.childStyle[this.index].top;
					} else {
						animate.top = this.childStyle[this.swapIndex].top;
					}
				}
				const dragScale = !this.props.dragClassName &&
				({
					scale: 1,
					boxShadow: '0 0px 0px rgba(0,0,0,0)',
				});
				return {
					...dragScale,
					...animate,
					onComplete: () => {
						const children = this.sortArray(this.state.children, this.swapIndex, this.index);
						const callbackBool = this.index !== this.swapIndex;
						this.index = null;
						this.childStyle = [];
						this.swapIndex = null;
						/*这种写法表示后面的函数里的东西是设置状态成功之后执行*/
						this.setState({
							style: {},
							childStyle: [],
							children,
							animation: [],
						}, () => {
							this.isDrage = false;
							if (callbackBool) {
								this.props.onChange(children);
							}
						});
					},
				};
			}
			return item;
		});

		if (this.props.dragClassName) {
			this.listDom.className = `${this.listDom.className
			.replace(this.props.dragClassName, '').trim()}`;
		}
		this.setState({ animation });
	};

	onMouseMove = (e) => {
		/*/*如果没有鼠标位置信息，就不进行计算
		应对情况：鼠标必须按下
		*/
		if (!this.mouseXY) {
			return;
		}
		/*鼠标位置赋值*/
		this.mouseXY.x = e.touches === undefined ? e.clientX : e.touches[0].clientX;
		this.mouseXY.y = e.touches === undefined ? e.clientY : e.touches[0].clientY;
		/*每个列表元素的样式*/
		const childStyle = this.state.childStyle;
		/*点击元素的样式*/
		let animation = this.state.animation;
		/*横轴运动*/
		if (this.props.animType === 'x') {
			// 懒得写现在没用。。。做成组件后加
			childStyle[this.index].left = this.mouseXY.x - this.mouseXY.startX + this.mouseXY.left;
		} else {
		/*纵轴运动*/
		/*当前元素的纵轴位置：现在鼠标y值-初始鼠标位置+元素初始的top*/
			childStyle[this.index].top = this.mouseXY.y - this.mouseXY.startY + this.mouseXY.top;
		/*swapIndex表示移动到的位置
		这句主要是判断向上移动的情况的
		当前激活元素的位置与之前的位置比较如果小于则等于0，否则就是this.index
		*/
			this.swapIndex = childStyle[this.index].top < this.childStyle[this.index].top ?
			0 : this.index;
		/*
		向下移动：如果当前元素的top值大于次元素初始位置的bottom值就最后一个元素的index
		这两段好像没啥用
		*/
			this.swapIndex = childStyle[this.index].top >
			this.childStyle[this.index].top + this.childStyle[this.index].height ?
			childStyle.length - 1 : this.swapIndex;

		/*
		经过上面两条语句逻辑为：
		激活元素的top如果小于激活前top，则swapIndex=0，
		激活元素的top如果大于激活前bottom，则swapIndex=（最后一个元素）childStyle.length - 1 
		激活元素的top如果大于激活前top，小于bottom（处于这个范围内），则swapIndex=this.index（当前index）
		*/

		/*
		目的是知道现在激活元素位置 上中下
		*/
		/*
			const top = childStyle[this.index].top;
			知道激活元素移动的位置(一直在变的那个)
		*/
			const top = childStyle[this.index].top;
		/*改动顺序了*/
			this.childStyle.forEach((item, i) => {
				const cTop = item.top;
				/*算上marginbottom的整天高度*/
				const cHeight = item.height + item.marginHeight;
				/*如果激活元素的top大于当前循环的元素的top且小于当前循环的元素的bottom*/
				/*则将目标位置设置为这个i*/
				if (top > cTop && top < cTop + cHeight) {
					this.swapIndex = i;
				}
			});
			
			animation = animation.map((item, i) => {
				// 到顶端
				/*
				激活元素的高度
				*/
				let height = this.childStyle[this.index].height;
				/*
				激活元素的初始位置与目标位置相比较
				*/
				/*如果目标位置大于初始位置（向下移动）*/
				if (this.index < this.swapIndex) {
					if (i > this.index && i <= this.swapIndex && this.swapIndex !== this.index) {
						const start = this.index + 1;
						const end = i;
						/*这块的意思是当前激活元素从初始位置到目标位置的所有元素*/
						height = 0;
						this.childStyle.slice(start, end).forEach((_item) => {
							height += _item.height + _item.marginHeight;
						});
						return { top: this.childStyle[this.index].top + height };
					/*当循环的i>目标值的情况
					其实和下面的i!=this.index重复了
					*/
					} else if (i > this.swapIndex) {
						return { top: this.childStyle[i].top };
					}
				} else if (this.index > this.swapIndex) {
				/*向上移动*/
					if (i < this.index && i >= this.swapIndex && this.swapIndex !== this.index) {
						height = this.childStyle[this.index].height + this.childStyle[this.index].marginHeight;
						return { top: this.childStyle[i].top + height };
					} else if (i < this.swapIndex ) {
						return { top: this.childStyle[i].top };
					}
				}
				/*如果位置没变,除了激活元素外的其他元素赋值位置信息*/
				if (i !== this.index) {
					return { top: this.childStyle[i].top };
				}
				return item;
			});

		}
		this.setState({ childStyle, animation });
	};

	/*单元素动画，拖拽时能有动画效果*/
	/*mouseDown绑定在每一个元素上面*/
	/*TweenOne没有找到这个用法*/
	getChildren = (item, i) => {
		const onMouseDown = this.onMouseDown.bind(this, i);
		const style = { ...this.state.childStyle[i] };
		console.log(item)
		return React.createElement(
			TweenOne,
			{
				/*这个是每个元素节点*/
				...item.props,
				/*----*/
				onMouseDown,
				onTouchStart: onMouseDown,
				style: { ...item.style, ...style },
				key: item.key,
				/*动画*/
				animation: this.state.animation[i],
				/*元素标签*/
				component: item.type,
			}
		);
	};

	/*交换变化后的位置信息*/
	sortArray = (_array, nextNum, num) => {
		const current = _array[num];
		const array = _array.map(item => item);
		array.splice(num, 1);
		array.splice(nextNum, 0, current);
		return array;
	};

	render() {
		const childrenToRender =this.state.children.map(this.getChildren);
		const props = { ...this.props };
		/*这一段的删除是删除props*/
		/*这一块不明白*/
		[
		'component',
		'animType',
		'dragClassName',
		'appearAnim',
		'onEventChange',
		].forEach(key => delete props[key]);
		/*如果设置了动画*/
		if (this.props.appearAnim) {
			return React.createElement(QueueAnim, {
			...props,
			/*动画方式*/
			...this.props.appearAnim,
			/*传入设置的样式*/
			style: { ...this.state.style },
			}, childrenToRender);
		}
		/*如果没设置动画*/
		return React.createElement(this.props.component, {
			...props,
			style: { ...this.state.style },
		}, childrenToRender);
	}
}

/*
//疑问1：getChildren这个为啥能绑定事件？
//
//
*/
